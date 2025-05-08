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

  // 表示されているウィンドウのサイズに応じた canvas 解像度
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;

  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = width;
  outputCanvas.height = height;
  const ctx = outputCanvas.getContext('2d');

  // videoの解像度とアスペクト比
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const videoAspect = vw / vh;
  const canvasAspect = width / height;

  let sx, sy, sw, sh;

  if (videoAspect > canvasAspect) {
    // videoが横長 → 左右をトリミング
    sw = vh * canvasAspect;
    sh = vh;
    sx = (vw - sw) / 2;
    sy = 0;
  } else {
    // videoが縦長 → 上下をトリミング
    sw = vw;
    sh = vw / canvasAspect;
    sx = 0;
    sy = (vh - sh) / 2;
  }

  // 背景のカメラ映像を描画（正しいアスペクト比でトリミング）
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, width, height);

  // A-Frameのcanvasも重ねる（3Dコンテンツ部分）
  ctx.drawImage(canvas, 0, 0, width, height);

  const imageDataURL = outputCanvas.toDataURL('image/png');

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  if (isIOS) {
    const win = window.open();
    win.document.write(`<img src="${imageDataURL}" style="width:100%">`);
  } else {
    const a = document.createElement('a');
    a.href = imageDataURL;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
});
