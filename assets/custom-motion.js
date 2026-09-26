(() => {
  const main = document.querySelector('main[data-template="index"]');
  if (!main) return;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const revealSelectors = [
    '.collection__title.title-wrapper',
    '.product-grid .grid__item',
  ];

  revealSelectors.forEach((selector) => {
    main.querySelectorAll(selector).forEach((element, index) => {
      if (!element.hasAttribute('data-reveal')) {
        element.setAttribute('data-reveal', '');
      }

      if (!element.style.getPropertyValue('--reveal-delay')) {
        element.style.setProperty('--reveal-delay', `${Math.min(index % 4, 3) * 90}ms`);
      }
    });
  });

  const revealItems = Array.from(main.querySelectorAll('[data-reveal]'));
  if (!revealItems.length) return;

  if (prefersReducedMotion || !('IntersectionObserver' in window)) {
    revealItems.forEach((element) => element.classList.add('is-revealed'));
    return;
  }

  document.documentElement.classList.add('motion-ready');

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        entry.target.classList.add('is-revealed');
        observer.unobserve(entry.target);
      });
    },
    {
      rootMargin: '0px 0px -12% 0px',
      threshold: 0.12,
    }
  );

  revealItems.forEach((element) => observer.observe(element));
})();
