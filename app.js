const express = require("express");
const path = require("path");
const bcrypt = require("bcrypt");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const dns = require("dns");

const userModel = require("./models/user");
const userPost = require("./models/post");
const multerconfig = require("./config/multerconfig");
const connectDB = require("./config/db.js");

dns.setServers(["1.1.1.1", "8.8.8.8"]);
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    console.error("JWT_SECRET is missing from environment variables.");
    process.exit(1);
}

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

connectDB();

function renderError(res, status, title, message, backUrl = "/profile") {
    return res.status(status).render("errors/error", { status, title, message, backUrl });
}

function isLoggedIn(req, res, next) {
    const token = req.cookies.token;

    if (!token) {
        return res.redirect("/login");
    }

    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch (err) {
        res.clearCookie("token");
        return res.redirect("/login");
    }
}

function getAuthOptions(req) {
    return {
        error: req.query.error || "",
        success: req.query.success || ""
    };
}

app.get("/", function (req, res) {
    res.render("register", getAuthOptions(req));
});

app.post("/register", async function (req, res) {
    try {
        const { name, username, age, email, password } = req.body;
        const cleanEmail = String(email || "").trim().toLowerCase();
        const cleanUsername = String(username || "").trim();

        if (!name || !cleanUsername || !age || !cleanEmail || !password) {
            return res.status(400).render("register", {
                error: "Please complete all fields.",
                success: ""
            });
        }

        if (password.length < 6) {
            return res.status(400).render("register", {
                error: "Password must be at least 6 characters.",
                success: ""
            });
        }

        if (Number(age) < 13 || Number(age) > 120) {
            return res.status(400).render("register", {
                error: "Please enter a valid age.",
                success: ""
            });
        }

        const existingEmail = await userModel.findOne({ email: cleanEmail });
        if (existingEmail) {
            return res.status(409).render("register", {
                error: "This email is already registered.",
                success: ""
            });
        }

        const existingUsername = await userModel.findOne({ username: cleanUsername });
        if (existingUsername) {
            return res.status(409).render("register", {
                error: "This username is already taken.",
                success: ""
            });
        }

        const hash = await bcrypt.hash(password, 12);

        await userModel.create({
            name: String(name).trim(),
            username: cleanUsername,
            age: Number(age),
            email: cleanEmail,
            password: hash
        });

        return res.redirect("/login?success=Registration%20successful.%20Please%20log%20in.");
    } catch (err) {
        console.error(err);
        return res.status(500).render("register", {
            error: "Something went wrong. Please try again.",
            success: ""
        });
    }
});

app.get("/login", function (req, res) {
    res.render("login", getAuthOptions(req));
});

app.post("/login", async function (req, res) {
    try {
        const email = String(req.body.email || "").trim().toLowerCase();
        const password = String(req.body.password || "");
        const user = await userModel.findOne({ email });

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).render("login", {
                error: "Email or password is incorrect.",
                success: ""
            });
        }

        const token = jwt.sign(
            { email: user.email, userid: user._id.toString() },
            JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.cookie("token", token, {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        return res.redirect("/profile");
    } catch (err) {
        console.error(err);
        return res.status(500).render("login", {
            error: "Something went wrong. Please try again.",
            success: ""
        });
    }
});

app.get("/logout", function (req, res) {
    res.clearCookie("token");
    res.redirect("/login?success=You%20have%20been%20logged%20out.");
});

app.get("/profile", isLoggedIn, async function (req, res) {
    try {
        const founduser = await userModel.findOne({ email: req.user.email }).populate("post");
        if (!founduser) return renderError(res, 404, "Profile not found", "We could not find your account.", "/login");

        const posts = await userPost.find().populate("user").sort({ date: -1 });
        res.render("profile", {
            founduser,
            post: posts,
            notice: req.query.notice || ""
        });
    } catch (err) {
        console.error(err);
        renderError(res, 500, "Could not load your feed", "Please refresh the page and try again.");
    }
});

app.post("/post", isLoggedIn, async function (req, res) {
    try {
        const content = String(req.body.postdata || "").trim();
        if (!content) return res.redirect("/profile?notice=Write%20something%20before%20posting.");
        if (content.length > 1000) return res.redirect("/profile?notice=Posts%20must%20be%201000%20characters%20or%20less.");

        const user = await userModel.findOne({ email: req.user.email });
        if (!user) return renderError(res, 404, "Account not found", "Your account could not be found.", "/login");

        const post = await userPost.create({ user: user._id, content });
        user.post.push(post._id);
        await user.save();
        res.redirect("/profile");
    } catch (err) {
        console.error(err);
        renderError(res, 500, "Could not create post", "Please try again.");
    }
});

app.post("/like/:postid", isLoggedIn, async function (req, res) {
    try {
        const post = await userPost.findById(req.params.postid);
        if (!post) return renderError(res, 404, "Post not found", "This post may have been deleted.");

        const userId = req.user.userid.toString();
        const index = post.likes.findIndex(id => id.toString() === userId);

        if (index === -1) post.likes.push(req.user.userid);
        else post.likes.splice(index, 1);

        await post.save();
        res.redirect(req.get("referer") || "/profile");
    } catch (err) {
        console.error(err);
        renderError(res, 500, "Could not update like", "Please try again.");
    }
});

app.get("/mypost", isLoggedIn, async function (req, res) {
    try {
        const founduser = await userModel.findOne({ email: req.user.email }).populate({
            path: "post",
            options: { sort: { date: -1 } }
        });
        if (!founduser) return renderError(res, 404, "Profile not found", "We could not find your account.", "/login");
        res.render("mypost", { founduser, notice: req.query.notice || "" });
    } catch (err) {
        console.error(err);
        renderError(res, 500, "Could not load your posts", "Please refresh and try again.");
    }
});

app.get("/edit/:postid", isLoggedIn, async function (req, res) {
    try {
        const [post, founduser] = await Promise.all([
            userPost.findOne({ _id: req.params.postid, user: req.user.userid }).populate("user"),
            userModel.findOne({ email: req.user.email })
        ]);
        if (!post) return renderError(res, 404, "Post not found", "You can only edit your own posts.", "/mypost");
        if (!founduser) return renderError(res, 404, "Profile not found", "We could not find your account.", "/login");
        res.render("edit", { post, founduser, notice: req.query.notice || "" });
    } catch (err) {
        console.error(err);
        renderError(res, 500, "Could not load the editor", "Please try again.");
    }
});

app.post("/update/:postid", isLoggedIn, async function (req, res) {
    try {
        const content = String(req.body.postdata || "").trim();
        if (!content) return res.redirect(`/edit/${req.params.postid}?notice=Post%20cannot%20be%20empty.`);
        if (content.length > 1000) return res.redirect(`/edit/${req.params.postid}?notice=Posts%20must%20be%201000%20characters%20or%20less.`);

        const updated = await userPost.findOneAndUpdate(
            { _id: req.params.postid, user: req.user.userid },
            { content },
            { new: true }
        );

        if (!updated) return renderError(res, 404, "Post not found", "You can only edit your own posts.", "/mypost");
        res.redirect("/mypost");
    } catch (err) {
        console.error(err);
        renderError(res, 500, "Could not update the post", "Please try again.");
    }
});

app.get("/profile/upload", isLoggedIn, async function (req, res) {
    try {
        const founduser = await userModel.findOne({ email: req.user.email });
        if (!founduser) return renderError(res, 404, "Profile not found", "We could not find your account.", "/login");
        res.render("uploadProfile", { founduser, notice: req.query.notice || "" });
    } catch (err) {
        console.error(err);
        renderError(res, 500, "Could not load your profile", "Please try again.");
    }
});

app.post("/profile/upload", isLoggedIn, multerconfig.single("image"), async function (req, res) {
    try {
        if (!req.file) return res.redirect("/profile/upload?notice=Please%20choose%20a%20valid%20image.");

        await userModel.findOneAndUpdate(
            { email: req.user.email },
            { profilePic: req.file.filename }
        );

        res.redirect("/profile");
    } catch (err) {
        console.error(err);
        renderError(res, 500, "Could not update your profile picture", "Please try again.");
    }
});

app.use(function (req, res) {
    renderError(res, 404, "Page not found", "The page you're looking for doesn't exist.", "/profile");
});

app.use(function (err, req, res, next) {
    console.error(err);
    if (err.code === "LIMIT_FILE_SIZE" || err.message === "INVALID_IMAGE_TYPE") {
        return renderError(res, 400, "Invalid image", "Please upload a JPG, PNG, WEBP, or GIF image up to 5 MB.", "/profile/upload");
    }
    renderError(res, 500, "Something went wrong", "Please refresh the page and try again.");
});

app.listen(PORT, function () {
    console.log(`Server running on port ${PORT}`);
});
