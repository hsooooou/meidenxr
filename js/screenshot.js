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

  // ファイル名（日時付き）
  const now = new Date();
  const fileName = `ar_screenshot_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}.png`;

   // 出力キャンバスを作成（WebGL canvasの実ピクセルサイズに合わせる）
   const width = canvas.width;
   const height = canvas.height;
 
   const outputCanvas = document.createElement('canvas');
   outputCanvas.width = width;
   outputCanvas.height = height;
   const ctx = outputCanvas.getContext('2d');

  // アスペクト比を保って video をトリミング描画
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const videoAspect = vw / vh;
  const canvasAspect = width / height;

  let sx, sy, sw, sh;
  if (videoAspect > canvasAspect) {
    sw = vh * canvasAspect;
    sh = vh;
    sx = (vw - sw) / 2;
    sy = 0;
  } else {
    sw = vw;
    sh = vw / canvasAspect;
    sx = 0;
    sy = (vh - sh) / 2;
  }

  // 背景にカメラ映像を描画
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, width, height);

  // A-FrameのWebGL描画を上に重ねる
  ctx.drawImage(canvas, 0, 0, width, height);

  // PNG形式で画像を出力
  const imageDataURL = outputCanvas.toDataURL('image/png');

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  if (isIOS) {
    // iOS → 別タブで画像表示 + 操作ボタン
    const win = window.open();
    if (win) {
      win.document.write(`
        <html>
          <head>
            <title>スクリーンショット</title>
            <style>
              body { text-align: center; margin: 0; font-family: sans-serif; background: #fff; }
              img { max-width: 100%; height: auto; margin-top: 1em; }
              .btn { display: inline-block; margin: 1em; padding: 0.8em 1.6em; background: #007aff; color: white; text-decoration: none; border-radius: 8px; font-size: 1em; }
            </style>
          </head>
          <body>
            <h2>スクリーンショット</h2>
            <img src="${imageDataURL}" alt="screenshot">
            <div>
              <a class="btn" href="${imageDataURL}" download="${fileName}">画像を保存</a>
              <a class="btn" href="javascript:window.close()">元のページに戻る</a>
            </div>
          </body>
        </html>
      `);
      win.document.close();
    }
  } else {
    // その他 → 自動で画像をダウンロード
    const a = document.createElement('a');
    a.href = imageDataURL;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
});

