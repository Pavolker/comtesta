document.addEventListener('DOMContentLoaded', () => {
  const mobileNavToggle = document.querySelector('.mobile-nav-toggle');
  const mainNav = document.querySelector('.main-nav');

  if (mobileNavToggle && mainNav) {
    const navId = 'site-navigation';
    mainNav.id = mainNav.id || navId;
    mobileNavToggle.setAttribute('aria-controls', mainNav.id);

    mobileNavToggle.addEventListener('click', () => {
      const isExpanded = mobileNavToggle.getAttribute('aria-expanded') === 'true';
      mobileNavToggle.setAttribute('aria-expanded', (!isExpanded).toString());
      mobileNavToggle.classList.toggle('active');
      mainNav.classList.toggle('active');
    });
  }

  const scrollLinks = document.querySelectorAll('.main-nav a[href^="#"], .logo[href^="#"], .back-to-top[href^="#"]');
  scrollLinks.forEach(link => {
    link.addEventListener('click', event => {
      const href = link.getAttribute('href');
      if (!href) {
        return;
      }

      const target = document.querySelector(href);
      if (!target) {
        return;
      }

      event.preventDefault();
      target.scrollIntoView({ behavior: 'smooth' });

      if (mainNav?.classList.contains('active')) {
        mobileNavToggle?.setAttribute('aria-expanded', 'false');
        mobileNavToggle?.classList.remove('active');
        mainNav.classList.remove('active');
      }
    });
  });

  const revealElements = document.querySelectorAll('.reveal');
  if (revealElements.length > 0) {
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });

    revealElements.forEach(element => revealObserver.observe(element));
  }

  const sections = document.querySelectorAll('main section[id]');
  const navLinks = document.querySelectorAll('.main-nav a[href^="#"]');
  if (sections.length > 0 && navLinks.length > 0) {
    const header = document.querySelector('.site-header');
    const headerHeight = header ? header.getBoundingClientRect().height : 0;

    const sectionObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          navLinks.forEach(link => {
            link.classList.toggle('active', link.getAttribute('href')?.slice(1) === entry.target.id);
          });
        }
      });
    }, {
      rootMargin: `-${headerHeight}px 0px -40% 0px`,
      threshold: 0
    });

    sections.forEach(section => sectionObserver.observe(section));
  }

  const backToTopButton = document.querySelector('.back-to-top');
  if (backToTopButton) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > window.innerHeight * 0.5) {
        backToTopButton.classList.add('visible');
      } else {
        backToTopButton.classList.remove('visible');
      }
    }, { passive: true });
  }

  const headerCta = document.querySelector('.header-cta');
  const footer = document.querySelector('.site-footer');
  if (headerCta && footer) {
    headerCta.addEventListener('click', event => {
      event.preventDefault();
      footer.scrollIntoView({ behavior: 'smooth' });
    });
  }
});
