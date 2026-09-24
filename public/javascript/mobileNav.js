document.addEventListener('DOMContentLoaded', function () {
    var button = document.querySelector('.menu-toggle');
    var drawer = document.querySelector('.mobile-drawer');
    var overlay = document.querySelector('.mobile-overlay');
    var closeButton = document.querySelector('.drawer-close');

    if (!button || !drawer || !overlay) {
        return;
    }

    function openMenu() {
        drawer.classList.add('is-open');
        overlay.classList.add('is-visible');
        button.setAttribute('aria-expanded', 'true');
        document.body.classList.add('menu-open');
    }

    function closeMenu() {
        drawer.classList.remove('is-open');
        overlay.classList.remove('is-visible');
        button.setAttribute('aria-expanded', 'false');
        document.body.classList.remove('menu-open');
    }

    button.addEventListener('click', function () {
        if (drawer.classList.contains('is-open')) {
            closeMenu();
        } else {
            openMenu();
        }
    });

    overlay.addEventListener('click', closeMenu);

    if (closeButton) {
        closeButton.addEventListener('click', closeMenu);
    }

    drawer.querySelectorAll('a').forEach(function (link) {
        link.addEventListener('click', closeMenu);
    });

    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') {
            closeMenu();
        }
    });
});
