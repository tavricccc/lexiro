// Inline this in <head> before any stylesheet paints: it sets data-theme from
// the system scheme and keeps following it. Pass the canvas colours of your
// palette so the browser chrome (theme-color) matches the page.
(function (light, dark) {
  var q = matchMedia("(prefers-color-scheme: dark)");
  var meta = document.querySelector('meta[name="theme-color"]');
  var apply = function () {
    document.documentElement.dataset.theme = q.matches ? "dark" : "light";
    if (meta) meta.content = q.matches ? dark : light;
  };
  apply();
  q.addEventListener("change", apply);
})("#f4f3f1", "#0d0c0b");
