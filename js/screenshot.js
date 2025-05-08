document.addEventListener('DOMContentLoaded', () => {
  document.querySelector('#screenshot').addEventListener('click', () => {
    const scene = document.querySelector('a-scene');
    const canvas = scene?.canvas;
    const video = document.querySelector('video');

    if (!canvas || !video || video.readyState < 2) {
      console.warn("Canvas or video not ready");
      return;
    }

    // 実際に表示されているサイズを取得（スマホ画面の縦長に合わせる）
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    // 出力キャンバスを画面比率に合わせる
    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = width;
    outputCanvas.height = height;
    const ctx = outputCanvas.getContext('2d');

    // videoの描画範囲を調整（アスペクト比がずれるのを防ぐ）
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const videoAspect = vw / vh;
    const screenAspect = width / height;

    let sx, sy, sw, sh;
    if (videoAspect > screenAspect) {
      // 横が長すぎる → 左右をカット
      sw = vh * screenAspect;
      sh = vh;
      sx = (vw - sw) / 2;
      sy = 0;
    } else {
      // 縦が長すぎる → 上下をカット
      sw = vw;
      sh = vw / screenAspect;
      sx = 0;
      sy = (vh - sh) / 2;
    }

    // 背景に video を描画（縦長に調整）
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, width, height);

    // A-Frame canvas を上に合成（同じサイズで）
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
});
