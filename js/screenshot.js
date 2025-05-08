document.addEventListener('DOMContentLoaded', () => {
  const screenshotBtn = document.getElementById('screenshot');
  let canvas = null;

  const scene = document.querySelector('a-scene');
  if (scene.hasLoaded) {
    canvas = scene.renderer?.domElement;
  } else {
    scene.addEventListener('renderstart', () => {
      canvas = scene.renderer?.domElement;
    });
  }

  screenshotBtn.addEventListener('click', () => {
    const video = document.querySelector('video[playsinline]') || document.querySelector('video');

    if (!canvas || !video || video.readyState < 2) {
      console.warn("Canvas or video not ready");
      return;
    }

    const now = new Date();
    const fileName = `ar_screenshot_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}.png`;

    const width = canvas.width;
    const height = canvas.height;

    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = width;
    outputCanvas.height = height;
    const ctx = outputCanvas.getContext('2d');

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

    // A-Frame のレンダリング結果を重ねる
    ctx.drawImage(canvas, 0, 0, width, height);

    const imageDataURL = outputCanvas.toDataURL('image/png');

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

    if (isIOS) {
      const win = window.open();
      if (win) {
        win.document.write(`
          <html><head><title>スクリーンショット</title>
          <style>body{margin:0;text-align:center;font-family:sans-serif;}img{max-width:100%;height:auto;margin-top:1em;}.btn{margin:1em;padding:0.8em 1.6em;background:#007aff;color:#fff;text-decoration:none;border-radius:8px;font-size:1em;}</style>
          </head><body>
          <h2>スクリーンショット</h2>
          <img src="${imageDataURL}" alt="screenshot">
          <div>
            <a class="btn" href="${imageDataURL}" download="${fileName}">画像を保存</a>
            <a class="btn" href="javascript:window.close()">閉じる</a>
          </div></body></html>
        `);
        win.document.close();
      }
    } else {
      try {
        const a = document.createElement('a');
        a.href = imageDataURL;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } catch (e) {
        // フォールバック
        window.open(imageDataURL, '_blank');
      }
    }
  });
});
