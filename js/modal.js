// モーダル要素を取得
var modal = document.getElementById("qrModal");
// モーダルを開くボタンを取得
var btn = document.getElementById("openModal");
// モーダルを閉じるアイコン（×）を取得
var span = document.getElementById("closeModal");

btn.onclick = function () {
  modal.style.display = "block";
}

span.onclick = function () {
  modal.style.display = "none";
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

$(function () {
  const copybtn = document.getElementById('copybtn');
  const copyok = document.getElementById('copyok');
  const url = 'https://forms.gle/yU6vn54oNLNisK5S8';

  copybtn.addEventListener('click', () => {
    navigator.clipboard.writeText(url).then(() => {
      // コピー成功時の処理
      copyok.classList.remove('copy-hidden');

      // 4秒後に非表示にする
      setTimeout(() => {
        copyok.classList.add('copy-hidden');
      }, 4000);
    }).catch(err => {
      console.error('コピーに失敗しました', err);
    });
  });
});
