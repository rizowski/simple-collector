(function() {
  const goalItems = $('li.goal-list-item');

  const titles = Array.from(goalItems.find('.list-item-type > strong'));
  const amounts = Array.from(goalItems.find('span.amount'));
  const urls = Array.from(goalItems.find('a.list-item-inner'));


  const myArr = titles.map((title, i) => {
    const id = $(urls[i]).attr('href').split('/').pop();
    const amount = amounts[i].innerText.split(',').join('');

    return `${id},${title.innerText}, ${amount}`;
  });

  console.log(myArr.join('\n'));

})();
