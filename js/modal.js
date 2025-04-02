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
$(function copyUrl() {
  var url = 'https://forms.gle/yU6vn54oNLNisK5S8';
  navigator.clipboard.writeText(url);


const copybtn = document.getElementById('copybtn');
const copyok = document.getElementById('copyok');

copybtn.addEventListener('click', () => {
  // ボタンクリックでhiddenクラスを付け外しする
  copyok.classList.toggle('copy-hidden');
});

function startTimer() {
  timerId = setTimeout( function() {
     copyok.classList.toggle('copy-hidden');
  } , 5000 );
}
// タイマーの中止
function abortTimer() {
  clearTimeout( timerId );
}

setTimeout(startTimer, 2000);

});