document.getElementById('screenshot').addEventListener('click', function () {
  const scene = document.querySelector('a-scene');
  const canvas = scene?.canvas;
  const video = document.querySelector('video');

  if (!canvas || !video || video.readyState < 2) {
    console.warn("Canvas or video not ready");
    return;
  }

  const now = new Date();
  const fileName = `ar_screenshot_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}.png`;

  const outputCanvas = document.createElement('canvas');
  const width = canvas.width;
  const height = canvas.height;
  outputCanvas.width = width;
  outputCanvas.height = height;
  const ctx = outputCanvas.getContext('2d');

  // video アスペクト比を保って描画
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const aspect = vw / vh;

  let drawVideoWidth = width;
  let drawVideoHeight = width / aspect;
  if (drawVideoHeight > height) {
    drawVideoHeight = height;
    drawVideoWidth = height * aspect;
  }

  const offsetX = (width - drawVideoWidth) / 2;
  const offsetY = (height - drawVideoHeight) / 2;

  // 背景: video
  ctx.drawImage(video, offsetX, offsetY, drawVideoWidth, drawVideoHeight);

  // 上に WebGL canvas を重ねる
  ctx.drawImage(canvas, 0, 0, width, height);

  const imageDataURL = outputCanvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = imageDataURL;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
});
