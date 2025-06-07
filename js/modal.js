document.addEventListener('DOMContentLoaded', () => {
// モーダル要素を取得
    var modal = document.getElementById("qrModal");
    // モーダルを開くボタンを取得
    var btn = document.getElementById("openModal");
    // モーダルを閉じるアイコン（×）を取得
    var span = document.getElementById("closeModal");

    // 要素が存在するかチェック（推奨）
    if (btn) {
      btn.onclick = function () {
        modal.style.display = "block";
      }
    }
    if (span) {
      span.onclick = function () {
        modal.style.display = "none";
      }
    }


    // モーダル要素を取得
    var modalmap = document.getElementById("qrModal-map");
    // モーダルを開くボタンを取得
    var btnmap = document.getElementById("openModal-map");
    // モーダルを閉じるアイコン（×）を取得
    var spanmap = document.getElementById("closeModal-map");

    // 要素が存在するかチェック（推奨）
    if (btnmap) {
      btnmap.onclick = function () {
        modalmap.style.display = "block";
      }
    }
    if (spanmap) {
      spanmap.onclick = function () {
        modalmap.style.display = "none";
      }
    }




//　リンクコピー
// $(function copyUrl() {
//   var url = 'https://forms.gle/yU6vn54oNLNisK5S8';
//   navigator.clipboard.writeText('https://forms.gle/yU6vn54oNLNisK5S8');
//   // document.execCommand('url')

//   const copybtn = document.getElementById('copybtn');
//   const copyok = document.getElementById('copyok');

//   // copybtn.addEventListener('click', () => {
//   //   // ボタンクリックでhiddenクラスを付け外しする
//   //   copyok.classList.toggle('copy-hidden');
//   // });

//   copybtn.addEventListener('click', () => {
//     function startTimer() {
//       timerId = setTimeout(function () {
//         copyok.classList.add('copy-hidden');
//       }, 4000);
//     }
//     setTimeout(startTimer, 1000);

//     timerId = setTimeout(function () {
//       copyok.classList.remove('copy-hidden');
//     }, 500);
//   });
//   navigator.clipboard.writeText('https://forms.gle/yU6vn54oNLNisK5S8');
//   return
// });

   function copyUrl() {
        const url = 'https://forms.gle/yU6vn54oNLNisK5S8';
        const copyok = document.getElementById('copyok');

        if (!copyok) {
            console.warn('copyok要素が見つかりませんでした。');
            return;
        }

        navigator.clipboard.writeText(url).then(() => {
          copyok.classList.remove('copy-hidden');

          setTimeout(() => {
            copyok.classList.add('copy-hidden');
          }, 4000);
        }).catch(err => {
          console.error('コピーに失敗しました', err);
        });
      }

      function copyUrlarfinish() {
        const url = 'https://hsooooou.github.io/meidenxr/ar-entrance.html';
        const copyok = document.getElementById('copyok-ar-finish');

        if (!copyok) {
            console.warn('copyok-ar-finish要素が見つかりませんでした。');
            return;
        }

        navigator.clipboard.writeText(url).then(() => {
          copyok.classList.remove('copy-hidden-ar-finish');

          setTimeout(() => {
            copyok.classList.add('copy-hidden-ar-finish');
          }, 4000);
        }).catch(err => {
          console.error('コピーに失敗しました', err);
        });
      }
      const copyBtn = document.getElementById('copybtn');
    if (copyBtn) {
        copyBtn.addEventListener('click', copyUrl);
    }

    const copyBtnArFinish = document.getElementById('copybtn-ar-finish'); // もしAR終了後のコピーボタンがあるなら
    if (copyBtnArFinish) {
        copyBtnArFinish.addEventListener('click', copyUrlarfinish);
    }
  });