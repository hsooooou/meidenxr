document.getElementById('screenshot').addEventListener('click', function () {
  const scene = document.querySelector('a-scene');
  const canvas = scene?.canvas;
  const video = document.querySelector('video');

  if (!canvas || !video) {
    console.warn("Canvas or video not found");
    return;
  }

  // 現在時刻からファイル名を生成
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const h = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const fileName = `ar_screenshot_${y}${m}${d}${h}${min}.png`;

  // 出力キャンバス作成
  const outputCanvas = document.createElement('canvas');
  const width = canvas.width;
  const height = canvas.height;
  outputCanvas.width = width;
  outputCanvas.height = height;
  const ctx = outputCanvas.getContext('2d');

  // カメラ映像（video）＋ WebGL描画（canvas）を合成
  ctx.drawImage(video, 0, 0, width, height);
  ctx.drawImage(canvas, 0, 0, width, height);

  // ダウンロード
  const imageDataURL = outputCanvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = imageDataURL;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
});
