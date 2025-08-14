// サポート画面開く
$('.question').click(function () {
  $('.question').toggleClass('is-active'); //クリックされた際にis-activeというクラスを切り替える
  $('.vr-info').toggleClass('is-active'); //すでにあれば消去、なければ追加

  updateButtonState(); // 状態更新処理を呼び出す
});

// ウィンドウリサイズ時に再度アイコンとボタンの状態を更新
$(window).resize(function () {
  updateButtonState();
});

// 状態更新処理
function updateButtonState() {
  const isActive = $('.question').hasClass('is-active'); //is-activeがついているか判断

  // アイコンの切り替え
  $('#map-icon').attr('src', isActive ? '../img/ar/map.svg' : '../img/ar/map_white.svg');
  $('#panorama-icon-img').attr('src', isActive ? '../img/ar/panorama.svg' : '../img/ar/panorama_white.svg');
  $('#key-icon').attr('src', isActive ? '../img/ar/key.svg' : '../img/ar/key_white.svg');

  // question ボタンを動的に背景画像・枠線切り替え
  $('.question').css({
    'background-image': isActive
      ? 'url(../img/vr/vr-btn-back.svg)' // trueの場合
      : 'url(../img/vr/vr-btn-question_white.svg)', // falseの場合
    'border': isActive ? '2px solid #231815' : 'none' // isActiveがtrueの場合にボタンに枠線（2px solid #231815）を表示
  });
}





$('.burger').click(function () {
  $('.under-list').toggleClass('is-active');
})




///////////////////////////////////////////////////




// 合言葉モーダル
function checkKeyword() { //正解のキーワードを”correctKeyword”に設定
  const correctKeyword = "スキヲキワメル";  // 正解の合言葉をここに設定
  const input = document.getElementById("keywordInput").value.trim(); //keywordInputの要素を取得 .valueで内容を取得 .trim()で不必要なスペースの消去
  const result = document.getElementById("keywordResult"); //id="keywordResult"を持つエラーメッセージを示す要素を取得

  if (input === correctKeyword) { //キーワードと一致するか確かめる
    window.location.href = "./ar-finish.html"; //一致した場合指定するページへ移動
  } else { 
    result.innerHTML = "合言葉が違うよ！もう一度試してね。<br>ヒント/公式Webにも？"; //エラーメッセージを表示する
    result.style.display = "block"; //エラーメッセージ要素を表示する

    setTimeout(() => {
      result.style.display = "none"; //エラーメッセージを非表示
    }, 10000); //10000 ミリ秒 = 10秒後に処理を実行
  }
}




///////////////////////////////////////////////////



// ARボタン - ページ遷移
window.addEventListener('DOMContentLoaded', () => { //全て読み込まれてから実行
  const cursor = document.querySelector('a-cursor'); //a-frame からcursor要素の取得

  // ここにマーカーパターンを記入　IDの設定に注意
  const markers = [
    {
      //n01-cr 普通教室
      patternUrl: 'pattern-armarker_n01-cr-iconin',
      link: 'https://hsooooou.github.io/meidenxr/schoolmap/vr-n01-cr.html',
      buttonId: 'button-n01-cr'
    },
    {
      //n02-idr 情報デザイン室
      // patternUrl: 'pattern-testplay_4_n02-idr',
      // link: 'https://hsooooou.github.io/meidenxr/schoolmap/vr-n02-idr.html',
      // buttonId: 'button-n02-idr'
    },
    {
      //n04-sta 売店
      patternUrl: 'pattern-armarker_n04-sta-iconin',
      link: 'https://hsooooou.github.io/meidenxr/schoolmap/vr-n04-sta.html',
      buttonId: 'button-n04-sta'
    },
    {
      //n06-ml メディアライブラリー
      patternUrl: 'pattern-armarker_n06-ml-iconin', 
      link: 'https://hsooooou.github.io/meidenxr/schoolmap/vr-n06-ml.html',
      buttonId: 'button-n06-ml'
    },
    {
      //n07-mr 音楽室
      patternUrl: 'pattern-armarker_n07-mr-iconin',
      link: 'https://hsooooou.github.io/meidenxr/schoolmap/n07-mr.html',
      buttonId: 'button-n07-mr'
    },
    {
      //n08-sc サテライト教室
      patternUrl: 'pattern-armarker_n08-sc-iconin',
      link: 'https://hsooooou.github.io/meidenxr/schoolmap/vr-n08-sc.html',
      buttonId: 'button-n08-sc'
    },
    {
      //n10-alr アクティブラーニング室
      patternUrl: 'pattern-armarker_n10-alr-iconin',
      link: 'https://hsooooou.github.io/meidenxr/schoolmap/vr-n10-alr.html',
      buttonId: 'button-n10-alr'
    },
    {
      //n11-cl 化学実験室
      // patternUrl: 'pattern-testplay_2_n11-cl',
      // link: 'https://hsooooou.github.io/meidenxr/schoolmap/vr-n11-cl.html',
      // buttonId: 'button-n-11-cl'
    },
    {
      //n12-ar 美術室
      // patternUrl: 'pattern-testplay_4_n02-idr',
      // link: 'https://hsooooou.github.io/meidenxr/schoolmap/vr-n12-ar.html',
      // buttonId: 'button-n12-ar'
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







///////////////////////////////////////////////////






// VRリンク UI直ボタン
window.addEventListener('DOMContentLoaded', () => {
  const button = document.querySelector('#panorama-icon'); //panorama-iconの要素を取得
  const icon = button.querySelector('.vr-menu-icon'); // .vr-menu-icon クラスを持つimgタグを取得



  // マーカーごとの設定
  const markers = [
    { //n01-cr 普通教室
      patternUrl: 'pattern-armarker_n01-cr-iconin',
      link: 'https://hsooooou.github.io/meidenxr/schoolmap/vr-n01-cr.html'
    },
    { //n02-idr 情報デザイン室
      // patternUrl: 'pattern-testplay_4_n02-idr',
      // link: 'https://hsooooou.github.io/meidenxr/schoolmap/vr-n02-idr.html'
    },
    { //n04-sta 売店
      patternUrl: 'pattern-armarker_n04-sta-iconin',
      link: 'https://hsooooou.github.io/meidenxr/schoolmap/vr-n04-sta.html'
    },
    { //n06-ml メディアライブラリー
      patternUrl: 'pattern-armarker_n06-ml-iconin',
      link: 'https://hsooooou.github.io/meidenxr/schoolmap/vr-n06-ml.html'
    },
    { //n07-mr 音楽室
      patternUrl: 'pattern-armarker_n07-mr-iconin', 
      link: 'https://hsooooou.github.io/meidenxr/schoolmap/vr-n07-mr.html'
    },
    { //n08-sc サテライト教室
      patternUrl: 'pattern-armarker_n08-sc-iconin',
      link: 'https://hsooooou.github.io/meidenxr/schoolmap/vr-n08-sc.html'
    },
    { //n10-alr アクティブラーニング室
      patternUrl: 'pattern-armarker_n10-alr-iconin',
      link: 'https://hsooooou.github.io/meidenxr/schoolmap/vr-n10-alr.html'
    },
    { //n11-cl 化学実験室
      // patternUrl: 'pattern-testplay_2_n11-cl',
      // link: 'https://hsooooou.github.io/meidenxr/schoolmap/vr-n11-cl.html'
    },
    { //n12-ar 美術室
      // patternUrl: 'pattern-testplay_4_n02-idr',
      // link: 'https://hsooooou.github.io/meidenxr/schoolmap/vr-n12-ar.html'
    },

    { // テスト用マーカー
      patternUrl: 'hiro', // Hiro マーカー（type="pattern" を省略しても a-frame 上は対応） patternUrl（マーカー画像のパターンファイル）
      link: 'https://hsooooou.github.io/meidenxr/' //対応するリンク
    }
  ];

  markers.forEach(marker => { //forEach すべてのマーカー設定に対して処理を行う
    // Hiro の場合、type="pattern" ではなく type="barcode" or type="pattern" なので柔軟に選定
    const markerSelector = marker.patternUrl === 'hiro'
      ? 'a-marker[type="pattern"][preset="hiro"], a-marker[preset="hiro"]'
      : `a-marker[url*="${marker.patternUrl}"]`;

    // 上記のセレクタに基づき、実際のマーカー要素(a-marker)を取得
    const markerEl = document.querySelector(markerSelector);
    if (!markerEl) return; //見つからなかった場合終了

    markerEl.addEventListener('markerFound', () => { //マーカーが見つかった時に動作
      icon.src = '../img/ar/panorama_active.svg'; // 色つきに変更する
      button.onclick = () => { //指定のリンクへと移動させる
        window.location.href = marker.link;
      };
    });

    markerEl.addEventListener('markerLost', () => { //マーカーが消えた時に動作
      icon.src = '../img/ar/panorama_white.svg'; // 元のアイコンに戻す
      button.onclick = null; //onclick イベントを 解除（null） ない状態でクリックしても動作しない
    });
  });
});
