// types the logo, pauses, deletes it, repeats
export function typeLogos() {
  document.querySelectorAll(".logo:not([data-typed])").forEach((el) => {
    const text = el.textContent.trim();
    el.dataset.typed = "1";
    el.innerHTML = '<span class="lt"></span><span class="cur"></span>';
    const t = el.firstChild;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      t.textContent = text;
      return;
    }
    let i = 0,
      dir = 1;
    const tick = () => {
      i += dir;
      t.textContent = text.slice(0, i);
      let wait = dir > 0 ? 110 : 55;
      if (i >= text.length) {
        dir = -1;
        wait = 2000;
      } else if (i <= 0) {
        dir = 1;
        wait = 600;
      }
      setTimeout(tick, wait);
    };
    tick();
  });
}
