// サポート画面開く
// 元々のクリックイベント
$('.question').click(function(){
  $('.question').toggleClass('is-active');
  $('.vr-info').toggleClass('is-active');
  
  // 画面幅が1025px未満の場合にアイコンの変更を行う
  if ($(window).width() < 1025) {
    // アイコン変更処理
    $('#map-icon').attr('src', '../img/ar/new-map-icon.svg');  // 新しいSVGアイコンに変更
    $('#panorama-icon-img').attr('src', '../img/ar/new-panorama-icon.svg');
    $('#key-icon').attr('src', '../img/ar/new-key-icon.svg');
  }
});


$('.burger').click(function(){
  $('.under-list').toggleClass('is-active');
})









// 合言葉モーダル
function checkKeyword() {
  const correctKeyword = "とまと";  // 正解の合言葉をここに設定
  const input = document.getElementById("keywordInput").value.trim();
  const result = document.getElementById("keywordResult");

  if (input === correctKeyword) {
    window.location.href = "./ar-finish.html";
  } else {
    result.innerHTML = "合言葉が違うよ！<br>もう一度試してね。";
    result.style.display = "block";

    setTimeout(() => {
      result.style.display = "none";
    }, 10000);
  }
}








// ARボタン - ページ遷移
window.addEventListener('DOMContentLoaded', () => {
  const marker = document.querySelector('a-marker');

  marker.addEventListener('markerFound', () => {
    const button = document.querySelector('#button-img');
    const cursor = document.querySelector('a-cursor');

    if (button && cursor) {
      // クリックイベント
      button.addEventListener('click', () => {
        window.location.href = 'https://hsooooou.github.io/meidenxr/schoolmap/vr-n02-idr.html';
      });

      // ホバー時：ボタンとカーソルの色を変える
      button.addEventListener('mouseenter', () => {
        button.setAttribute('material', 'color', '#F5F185');     // ボタンを黄色
        cursor.setAttribute('material', 'color', '#231815');     // カーソルを黒に
      });

      // ホバー外れたら：元に戻す
      button.addEventListener('mouseleave', () => {
        button.setAttribute('material', 'color', '#fafafa');     // ボタン元に戻す
        cursor.setAttribute('material', 'color', 'white');       // カーソル白に戻す
      });
    }
  });
});













// VRリンク
window.addEventListener('DOMContentLoaded', () => {
  const button = document.querySelector('#panorama-icon');
  const icon = button.querySelector('.vr-menu-icon');

  // マーカーごとの設定（2つ目を Hiro に）
  const markers = [
    {
      patternUrl: 'pattern-club_information_design.patt', // クラブ用
      link: 'https://hsooooou.github.io/meidenxr/schoolmap/vr-n02-idr.html'
    },
    {
      
      // テスト用マーカー
      patternUrl: 'hiro', // Hiro マーカー（type="pattern" を省略しても a-frame 上は対応）
      link: 'https://hsooooou.github.io/meidenxr/'
    }
  ];

  markers.forEach(marker => {
    // Hiro の場合、type="pattern" ではなく type="barcode" or type="pattern" なので柔軟に選定
    const markerSelector = marker.patternUrl === 'hiro'
      ? 'a-marker[type="pattern"][preset="hiro"], a-marker[preset="hiro"]'
      : `a-marker[url*="${marker.patternUrl}"]`;

    const markerEl = document.querySelector(markerSelector);
    if (!markerEl) return;

    markerEl.addEventListener('markerFound', () => {
      icon.src = '../img/ar/panorama_active.svg'; // 色つきバージョン
      button.onclick = () => {
        window.location.href = marker.link;
      };
    });

    markerEl.addEventListener('markerLost', () => {
      icon.src = '../img/ar/panorama.svg'; // 通常バージョンに戻す
      button.onclick = null;
    });
  });
});
