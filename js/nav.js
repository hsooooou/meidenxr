"use strict";
$(function () {
  const hamburger = $(".hamburger");
  const nav = $(".nav");

  hamburger.click(function () {
    $(this).find(".hamburger_bar").toggleClass("is_active");
    nav.toggleClass("is_active");
  });
});

// ハンバーガー
// toggle あったら外すなかったら付与
$('.burger').click(function(){
  $('.burger').toggleClass('is-active');
  $('.menu').toggleClass('is-active');
})