document.getElementById('screenshot').addEventListener('click', function () {
  const scene = document.querySelector('a-scene');
  const canvas = scene?.canvas;
  const video = document.querySelector('video');

  if (!canvas || !video || video.readyState < 2) {
    console.warn("Canvas or video not ready");
    return;
  }

  // ファイル名生成
  const now = new Date();
  const fileName = `ar_screenshot_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}.png`;

  const outputCanvas = document.createElement('canvas');
  const width = canvas.width;
  const height = canvas.height;
  outputCanvas.width = width;
  outputCanvas.height = height;
  const ctx = outputCanvas.getContext('2d');

  // video サイズとアスペクト比
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const videoAspect = vw / vh;
  const canvasAspect = width / height;

  let sx, sy, sw, sh;

  if (videoAspect > canvasAspect) {
    // videoが横長すぎる → 左右をカット
    sh = vh;
    sw = vh * canvasAspect;
    sx = (vw - sw) / 2;
    sy = 0;
  } else {
    // videoが縦長すぎる → 上下をカット
    sw = vw;
    sh = vw / canvasAspect;
    sx = 0;
    sy = (vh - sh) / 2;
  }

  // videoからトリミング描画
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, width, height);

  // canvasを上から合成
  ctx.drawImage(canvas, 0, 0, width, height);

  const imageDataURL = outputCanvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = imageDataURL;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
});
