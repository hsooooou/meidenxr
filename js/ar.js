// サポート画面開く
$('.question').click(function(){
  $('.question').toggleClass('is-active');
  $('.vr-info').toggleClass('is-active');
})

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
  const button = document.querySelector('#button-img');

  // タップで判定
  window.addEventListener('click', function (event) {
    // Raycasterセットアップ
    const scene = document.querySelector('a-scene');
    const camera = scene.camera;
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    // タップ座標を正規化 [-1, 1] に変換
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    // A-Frameのメッシュを取得して交差判定
    const intersects = raycaster.intersectObject(button.object3D, true);

    if (intersects.length > 0) {
      window.location.href = 'https://hsooooou.github.io/meidenxr/schoolmap/vr-n02-idr.html';
    }
  });
});

