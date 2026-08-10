// Comportamento client-side da casca (sidebar, tema, cor de acento por módulo, hub
// flutuante) — ver DESIGN-SYSTEM.md e o adendo sobre migracao-go. Vanilla JS porque não há
// bundler/React neste binário; o objetivo é imitar o mesmo resultado dos apps Next.js
// (usePathname() pra link ativo, next-themes pra tema) com o mínimo de código.

(function inicializarTemaEModulo() {
  // Roda síncrono, antes da primeira pintura (script sem `defer` no <head>), pra não haver
  // flash de tema/cor errados — mesmo motivo do script bloqueante do next-themes.
  var raiz = document.documentElement;

  var tema = localStorage.getItem('tema');
  if (!tema) {
    tema = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'escuro' : 'claro';
  }
  raiz.classList.toggle('escuro', tema === 'escuro');

  var caminho = location.pathname;
  var modulo = 'identidade';
  if (caminho.indexOf('/painel') === 0) modulo = 'painel';
  else if (caminho.indexOf('/almoxarifado') === 0) modulo = 'almoxarifado';
  raiz.setAttribute('data-modulo', modulo);
})();

document.addEventListener('DOMContentLoaded', function () {
  var CHAVE_COLAPSADA = 'sidebar-colapsada';
  var raiz = document.documentElement;
  var barraLateral = document.getElementById('barra-lateral');

  // Tema — qualquer botão marcado com data-alternar-tema (existe um na sidebar, desktop, e
  // outro no header mobile).
  document.querySelectorAll('[data-alternar-tema]').forEach(function (botao) {
    botao.addEventListener('click', function () {
      var escuro = !raiz.classList.contains('escuro');
      raiz.classList.toggle('escuro', escuro);
      localStorage.setItem('tema', escuro ? 'escuro' : 'claro');
    });
  });

  // Colapsar sidebar (desktop) — persistido, mesma chave usada pelos apps Next.js.
  if (barraLateral) {
    if (localStorage.getItem(CHAVE_COLAPSADA) === '1') {
      barraLateral.classList.add('colapsada');
    }
    document.querySelectorAll('[data-alternar-colapso]').forEach(function (botao) {
      botao.addEventListener('click', function () {
        var colapsada = barraLateral.classList.toggle('colapsada');
        localStorage.setItem(CHAVE_COLAPSADA, colapsada ? '1' : '0');
      });
    });
  }

  // Drawer mobile — abrir/fechar + backdrop.
  var fundoMenu = document.querySelector('[data-fundo-menu]');
  function abrirMenu() {
    if (!barraLateral) return;
    barraLateral.classList.add('aberta');
    if (fundoMenu) fundoMenu.classList.add('visivel');
    document.querySelectorAll('[data-abrir-menu]').forEach(function (b) { b.setAttribute('aria-expanded', 'true'); });
  }
  function fecharMenu() {
    if (!barraLateral) return;
    barraLateral.classList.remove('aberta');
    if (fundoMenu) fundoMenu.classList.remove('visivel');
    document.querySelectorAll('[data-abrir-menu]').forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
  }
  document.querySelectorAll('[data-abrir-menu]').forEach(function (b) { b.addEventListener('click', abrirMenu); });
  document.querySelectorAll('[data-fechar-menu]').forEach(function (b) { b.addEventListener('click', fecharMenu); });
  if (fundoMenu) fundoMenu.addEventListener('click', fecharMenu);

  // Link ativo — mesma ideia do usePathname() dos apps Next.js (DESIGN-SYSTEM.md §9), aqui
  // por correspondência de prefixo contra os hrefs internos.
  var caminho = location.pathname;
  document.querySelectorAll('[data-nav]').forEach(function (link) {
    var href = link.getAttribute('href');
    if (!href || href.indexOf('/') !== 0) return; // link externo (RH/Alojamentos) nunca fica ativo
    var ativo = href === '/' ? caminho === '/' : caminho.indexOf(href) === 0;
    if (ativo) {
      link.classList.add('ativo');
      link.setAttribute('aria-current', 'page');
    }
  });

  // Hub flutuante — abre/fecha, fecha ao clicar fora ou Esc.
  var hub = document.querySelector('[data-hub-flutuante]');
  if (hub) {
    var hubBotao = hub.querySelector('[data-hub-flutuante-botao]');
    var hubMenu = hub.querySelector('[data-hub-flutuante-menu]');
    hubBotao.addEventListener('click', function () {
      var aberto = hub.classList.toggle('aberto');
      hubBotao.setAttribute('aria-expanded', aberto ? 'true' : 'false');
    });
    document.addEventListener('click', function (e) {
      if (hub.classList.contains('aberto') && !hub.contains(e.target)) {
        hub.classList.remove('aberto');
        hubBotao.setAttribute('aria-expanded', 'false');
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && hub.classList.contains('aberto')) {
        hub.classList.remove('aberto');
        hubBotao.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // Canvas de assinatura (RH — entrega de uniforme) — desenha no <canvas
  // data-testid="assinatura-canvas"> e grava o PNG como data URI num <input hidden> antes
  // do submit, mesmo formato que o Next.js gravava em EntregaUniforme.assinatura.
  document.querySelectorAll('canvas[data-assinatura]').forEach(function (canvas) {
    var ctx = canvas.getContext('2d');
    var desenhando = false;
    var form = canvas.closest('form');
    var campoOculto = form ? form.querySelector('input[name="assinatura"]') : null;

    function posicao(e) {
      var r = canvas.getBoundingClientRect();
      var ponto = e.touches ? e.touches[0] : e;
      return { x: ponto.clientX - r.left, y: ponto.clientY - r.top };
    }
    function iniciar(e) {
      desenhando = true;
      var p = posicao(e);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
    }
    function desenhar(e) {
      if (!desenhando) return;
      var p = posicao(e);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      e.preventDefault();
    }
    function parar() {
      if (!desenhando) return;
      desenhando = false;
      if (campoOculto) campoOculto.value = canvas.toDataURL('image/png');
    }
    canvas.addEventListener('mousedown', iniciar);
    canvas.addEventListener('mousemove', desenhar);
    window.addEventListener('mouseup', parar);
    canvas.addEventListener('touchstart', iniciar);
    canvas.addEventListener('touchmove', desenhar);
    canvas.addEventListener('touchend', parar);
  });
});
