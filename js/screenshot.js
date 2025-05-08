document.querySelector('#screenshot').addEventListener('click', () => {
  const scene = document.querySelector('a-scene');
  const canvas = scene?.canvas;
  const video = document.querySelector('video');

  if (!canvas || !video || video.readyState < 2) {
    console.warn("Canvas or video not ready");
    return;
  }

  const rect = canvas.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;

  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = width;
  outputCanvas.height = height;
  const ctx = outputCanvas.getContext('2d');

  // videoを表示サイズで描画
  ctx.drawImage(video, 0, 0, width, height);

  // canvas（WebGL）を合成
  ctx.drawImage(canvas, 0, 0, width, height);

  const imageDataURL = outputCanvas.toDataURL('image/png');

  const now = new Date();
  const fileName = `screenshot_${now.toISOString().replace(/[-:T]/g, '').slice(0, 12)}.png`;

  const a = document.createElement('a');
  a.href = imageDataURL;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
});

