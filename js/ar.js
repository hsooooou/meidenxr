// サポート画面開く
$('.question').click(function () {
  $('.question').toggleClass('is-active');
  $('.vr-info').toggleClass('is-active');

  if ($(window).width() < 1025) {
    const isActive = $('.question').hasClass('is-active');

    // アイコン切り替え（1024px以下のみ）
    $('#map-icon').attr('src', isActive ? '../img/ar/map.svg' : '../img/ar/map_white.svg');
    $('#panorama-icon-img').attr('src', isActive ? '../img/ar/panorama.svg' : '../img/ar/panorama_white.svg');
    $('#key-icon').attr('src', isActive ? '../img/ar/key.svg' : '../img/ar/key_white.svg');

    // question ボタンの背景画像・枠線 切り替え（1024px以下のみ）
    $('.question').css({
      'background-image': isActive
        ? 'url(../img/vr/vr-btn-back.svg)'
        : 'url(../img/vr/vr-btn-question_white.svg)',
      'border': isActive ? '2px solid #231815' : 'none'
    });
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




///////////////////////////////////////////////////



// ARボタン - ページ遷移
window.addEventListener('DOMContentLoaded', () => { //全て読み込まれてから実行
  const cursor = document.querySelector('a-cursor'); //a-frame からcursor要素の取得

  // ここにマーカーパターンを記入　IDの設定に注意
  const markers = [
    { 
      //n02-idr 情報デザイン室
      patternUrl: 'pattern-club_information_design.patt',
      link: 'https://hsooooou.github.io/meidenxr/schoolmap/vr-n02-idr.html',
      buttonId: 'button-n02-idr' 
    },
    {
      //テスト用マーカー hiro
      patternUrl: 'hiro', //マーカー画像のパターン
      link: 'https://hsooooou.github.io/meidenxr/', //遷移するURL
      buttonId: 'button-test-hiro' //a-imageに設定したidをここに記入
    }
  ];

  markers.forEach(marker => { //マーカーを一つずつ処理する
    //hiroマーカーのみ特殊に処理
    const markerSelector = marker.patternUrl === 'hiro'
      ? 'a-marker[type="pattern"][preset="hiro"], a-marker[preset="hiro"]'
      : `a-marker[url*="${marker.patternUrl}"]`;

    // マーカーとボタンとカーソルが取得できなければスキップ
    const markerEl = document.querySelector(markerSelector);
    const button = document.querySelector(`#${marker.buttonId}`);
    if (!markerEl || !button || !cursor) return;

    // 各マーカーの表示時 → マーカーが検出されたときの処理を定義
    markerEl.addEventListener('markerFound', () => {
      const handleClick = () => window.location.href = marker.link; //ボタンがクリックされたら設定したURLにジャン     
      const handleEnter = () => { // ホバー（マウスが乗ったとき）で色を変更
        button.setAttribute('material', 'color', '#F5F185');
        cursor.setAttribute('material', 'color', '#231815');
      };  
      const handleLeave = () => {  // ホバーが外れたときに元の色に戻す
        button.setAttribute('material', 'color', '#fafafa');
        cursor.setAttribute('material', 'color', 'white');
      };

      //上の関数をイベントとしてボタンに登録
      button.addEventListener('click', handleClick);
      button.addEventListener('mouseenter', handleEnter);
      button.addEventListener('mouseleave', handleLeave);

      markerEl.addEventListener('markerLost', () => { //マーカーが見えなくなったとき
        // イベントを解除（残ったままだと別マーカーでバグる可能性があるため）
        button.removeEventListener('click', handleClick);
        button.removeEventListener('mouseenter', handleEnter);
        button.removeEventListener('mouseleave', handleLeave);
        // 色を初期状態に戻す
        button.setAttribute('material', 'color', '#fafafa');
        cursor.setAttribute('material', 'color', 'white');
      });
    });
  });
});














// VRリンク UI直ボタン
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
      icon.src = '../img/ar/panorama_white.svg'; // 通常バージョンに戻す
      button.onclick = null;
    });
  });
});
