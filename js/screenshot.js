document.querySelector('#screenshot').addEventListener('click', () => {
  const scene = document.querySelector('a-scene');
  const canvas = scene?.canvas;
  const video = document.querySelector('video');

  if (!canvas || !video || video.readyState < 2) {
    console.warn("Canvas or video not ready");
    return;
  }

  // WebGLキャンバスの実際のサイズを取得
  const width = canvas.width;
  const height = canvas.height;

  // 出力用キャンバス
  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = width;
  outputCanvas.height = height;
  const ctx = outputCanvas.getContext('2d');

  // video のサイズとアスペクト比を取得
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const videoAspect = vw / vh;
  const canvasAspect = width / height;

  let sx, sy, sw, sh;

  // アスペクト比に基づいて video をトリミング
  if (videoAspect > canvasAspect) {
    // 横長なので左右カット
    sh = vh;
    sw = vh * canvasAspect;
    sx = (vw - sw) / 2;
    sy = 0;
  } else {
    // 縦長なので上下カット
    sw = vw;
    sh = vw / canvasAspect;
    sx = 0;
    sy = (vh - sh) / 2;
  }

  // 背景として video を描画
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, width, height);

  // WebGL描画を合成（canvasの実サイズで）
  ctx.drawImage(canvas, 0, 0, width, height);

  // ファイル名
  const now = new Date();
  const fileName = `screenshot_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}.png`;

  // 自動ダウンロード
  const a = document.createElement('a');
  a.href = outputCanvas.toDataURL('image/png');
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
});
