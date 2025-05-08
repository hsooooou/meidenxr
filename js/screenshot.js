window.addEventListener('load', () => {
  const screenshotLi = document.getElementById('screenshot');
  if (!screenshotLi) {
    console.warn('Screenshot button not found.');
    return;
  }

  screenshotLi.addEventListener('click', () => {
    setTimeout(() => {
      const scene = document.querySelector('a-scene');
      if (!scene || !scene.renderer) {
        console.warn('A-Frame scene or renderer not available.');
        return;
      }

      const canvas = scene.renderer.domElement;
      const dataURL = canvas.toDataURL('image/png');

      const now = new Date();
      const filename = `screenshot_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}.png`;

      const link = document.createElement('a');
      link.href = dataURL;
      link.download = filename;
      link.click();
    }, 1000);
  });
});
