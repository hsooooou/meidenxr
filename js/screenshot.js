// document.getElementById('screenshot').addEventListener('click', function () {
//   const scene = document.querySelector('a-scene');
//   const canvas = scene?.canvas;
//   const video = document.querySelector('video');

//   if (!canvas || !video || video.readyState < 2) {
//     console.warn("Canvas or video not ready");
//     return;
//   }

//   // ファイル名生成
//   const now = new Date();
//   const fileName = `ar_screenshot_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}.png`;

//   const outputCanvas = document.createElement('canvas');
//   const width = canvas.width;
//   const height = canvas.height;
//   outputCanvas.width = width;
//   outputCanvas.height = height;
//   const ctx = outputCanvas.getContext('2d');

//   // video サイズとアスペクト比
//   const vw = video.videoWidth;
//   const vh = video.videoHeight;
//   const videoAspect = vw / vh;
//   const canvasAspect = width / height;

//   let sx, sy, sw, sh;

//   if (videoAspect > canvasAspect) {
//     // videoが横長すぎる → 左右をカット
//     sh = vh;
//     sw = vh * canvasAspect;
//     sx = (vw - sw) / 2;
//     sy = 0;
//   } else {
//     // videoが縦長すぎる → 上下をカット
//     sw = vw;
//     sh = vw / canvasAspect;
//     sx = 0;
//     sy = (vh - sh) / 2;
//   }

//   // videoからトリミング描画
//   ctx.drawImage(video, sx, sy, sw, sh, 0, 0, width, height);

//   // canvasを上から合成
//   ctx.drawImage(canvas, 0, 0, width, height);

//   const imageDataURL = outputCanvas.toDataURL('image/png');
//   const a = document.createElement('a');
//   a.href = imageDataURL;
//   a.download = fileName;
//   document.body.appendChild(a);
//   a.click();
//   document.body.removeChild(a);
// });

document.getElementById('screenshot').addEventListener('click', function () {
  const scene = document.querySelector('a-scene');
  const canvas = scene?.canvas;
  const video = document.querySelector('video');

  if (!canvas || !video || video.readyState < 2) {
    console.warn("Canvas or video not ready");
    return;
  }

  // 日付と時間を使ってファイル名を生成
  const now = new Date();
  const fileName = `ar_screenshot_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}.png`;

  // 表示されているcanvasサイズを基に出力キャンバスを作成
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;

  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = width;
  outputCanvas.height = height;
  const ctx = outputCanvas.getContext('2d');

  // カメラ映像のアスペクト比調整
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const videoAspect = vw / vh;
  const canvasAspect = width / height;

  let sx, sy, sw, sh;

  if (videoAspect > canvasAspect) {
    // カメラが横長 → 左右をカット
    sw = vh * canvasAspect;
    sh = vh;
    sx = (vw - sw) / 2;
    sy = 0;
  } else {
    // カメラが縦長 → 上下をカット
    sw = vw;
    sh = vw / canvasAspect;
    sx = 0;
    sy = (vh - sh) / 2;
  }

  // 1. 背景にカメラ映像を描画（トリミングしてアスペクト比を維持）
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, width, height);

  // 2. その上にA-FrameのWebGL描画結果を重ねる
  ctx.drawImage(canvas, 0, 0, width, height);

  // PNGデータURLを生成
  const imageDataURL = outputCanvas.toDataURL('image/png');

  // スマホ(iOS)は直接保存できないため、新しいウィンドウに画像表示
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  if (isIOS) {
    const win = window.open();
    win.document.write(`<img src="${imageDataURL}" style="width:100%">`);
  } else {
    // 他の環境ではダウンロードを自動実行
    const a = document.createElement('a');
    a.href = imageDataURL;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
});

