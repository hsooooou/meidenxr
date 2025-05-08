document.getElementById('screenshot').addEventListener('click', function () {
  const scene = document.querySelector('a-scene');
  const canvas = scene?.canvas;
  const video = document.querySelector('video');

  if (!canvas || !video || video.readyState < 2) {
    console.warn("Canvas or video not ready");
    return;
  }

  // 表示されているサイズを取得（スタイル上の表示ピクセルサイズ）
  const rect = canvas.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;

  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = width;
  outputCanvas.height = height;
  const ctx = outputCanvas.getContext('2d');

  // video をそのまま画面にフィットするように描画
  ctx.drawImage(video, 0, 0, width, height);

  // WebGL canvas を重ねる
  ctx.drawImage(canvas, 0, 0, width, height);

  // 画像データを PNG で生成
  const imageDataURL = outputCanvas.toDataURL('image/png');

  // ファイル名（日時付き）
  const now = new Date();
  const fileName = `ar_screenshot_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}.png`;

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  if (isIOS) {
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
    const a = document.createElement('a');
    a.href = imageDataURL;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
});
