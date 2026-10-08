function loadPartial(url, placeholderId, callback) {
  var placeholder = document.getElementById(placeholderId);
  if (!placeholder) return;

  fetch(url)
    .then(function (res) {
      return res.text();
    })
    .then(function (html) {
      placeholder.outerHTML = html;
      if (callback) callback();
    })
    .catch(function (err) {
      console.error("Failed to load " + url, err);
    });
}

function initNav() {
  var toggle = document.getElementById("nav-toggle");
  var nav = document.getElementById("global-nav");
  var isIndexPage = /(^|\/)(index\.html)?$/.test(window.location.pathname);

  if (!isIndexPage) {
    document.querySelectorAll(".site-header a.logo, .global-nav a").forEach(function (link) {
      var href = link.getAttribute("href");
      if (href === "#") {
        link.setAttribute("href", "index.html");
      } else if (href && href.charAt(0) === "#") {
        link.setAttribute("href", "index.html" + href);
      }
    });
  }

  if (!toggle || !nav) return;

  toggle.addEventListener("click", function () {
    var isOpen = nav.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
  });

  nav.querySelectorAll("a").forEach(function (link) {
    link.addEventListener("click", function () {
      nav.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    });
  });
}

document.addEventListener("DOMContentLoaded", function () {
  loadPartial("header.html", "site-header-placeholder", initNav);
  loadPartial("footer.html", "site-footer-placeholder");
});

// ===== サイト共有ボタン =====
document.querySelectorAll('.js-share-site').forEach((btn) => {
  const label = btn.querySelector('.js-share-label');
  const original = label.textContent;
  const shareData = {
    title: 'sonosann Web&AIサポート',
    text: '介護のDXをWeb&AIでサポート',
    url: 'https://sonosann-webai.net/'
  };
  btn.addEventListener('click', async () => {
    if (navigator.share) {
      try { await navigator.share(shareData); } catch (e) {}
      return;
    }
    try {
      await navigator.clipboard.writeText(shareData.url);
      label.textContent = 'コピーしました！';
      setTimeout(() => { label.textContent = original; }, 2000);
    } catch (e) {
      window.prompt('このURLをコピーしてください', shareData.url);
    }
  });
});
