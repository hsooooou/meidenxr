document.getElementById('screenshot').addEventListener('click', function () {
  const scene = document.querySelector('a-scene');

  if (!scene || !scene.renderer || !scene.canvas) {
    console.warn("Scene or canvas not found.");
    return;
  }

  // レンダリングされたcanvasを取得
  const canvas = scene.canvas;

  // canvasから画像データを取得
  const imageDataURL = canvas.toDataURL('image/png');

  // 自動ダウンロード
  const a = document.createElement('a');
  a.href = imageDataURL;
  a.download = 'ar_screenshot.png';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
});
