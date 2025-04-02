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

  // フラッシュメッセージ表示
  $('.success-msg').fadeIn("slow", function () {
    $(this).delay(2000).fadeOut("slow");
  });
});
