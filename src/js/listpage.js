import Page from './page.js';
import text from './text.js';
import file from './file.js';
import TouchListener from './touch.js';

export default class ListPage extends Page {
  constructor() {
    super(document.querySelector('#list_page'));
  }
  matchUrl(url) { return url === '/'; }
  getUrl(param) { return '/'; }
  async onFirstActive() {
    this.addButton = document.querySelector('#add');
    /** @type {HTMLInputElement} */
    this.fileButton = document.querySelector('#file');
    this.settingsButton = document.querySelector('#settings');
    this.fileListContainer = document.querySelector('.file-list-container');
    this.fileList = document.querySelector('.file-list');
    /** @type {HTMLTemplateElement} */
    this.fileListItem = document.querySelector('#list_item');
    this.sortContent = document.querySelector('.list-sort-content');
    this.sortMenu = document.querySelector('.list-sort-menu');
    this.initialListener();
    this.options = { sortBy: 'dateread' };
  }
  async onActive() {
    this.updateSort();
    await this.updateList();
  }
  async onDeactive() {
    this.clearList();
  }
  initialListener() {
    this.addButton.addEventListener('click', event => {
      this.fileButton.click();
    });
    this.fileButton.addEventListener('change', async event => {
      const files = this.fileButton.files;
      if (files.length === 1) {
        const item = files.item(0);
        const content = await text.readFile(item);
        const title = text.parseFilename(item.name);
        await file.add({ title, content });
      }
      this.fileButton.value = null;
      this.updateList();
    });
    this.sortContent.addEventListener('click', event => {
      this.sortMenu.style.display = 'block';
    });
    this.sortMenu.addEventListener('click', event => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const item = target.closest('.screen-option-item');
      if (!item) return;
      const option = item.dataset.option;
      if (option) {
        this.options.sortBy = option;
        this.updateSort();
        this.updateList();
      }
      this.sortMenu.style.display = 'none';
    });
  }
  async updateList() {
    const token = this.lastToken = {};
    const files = await file.list();
    this.sortFiles(files);
    if (token !== this.lastToken) return;
    this.clearList();
    files.forEach(item => {
      /** @type {HTMLFrameElement} */
      const container = this.fileListItem.content.cloneNode(true);
      const li = container.querySelector('li');
      li.querySelector('.file-title').textContent = item.title;
      const date = item.lastAccessTime.toLocaleDateString();
      li.querySelector('.file-date').textContent = date;
      const percent = item.cursor ?
        (item.cursor / item.length * 100).toFixed(2) + '%' :
        'NEW';
      li.querySelector('.file-detail').textContent = percent;
      li.addEventListener('scroll', event => {
        if (li.scrollLeft > 150) li.scrollLeft = 150;
      });
      const content = li.querySelector('.file-item-content');
      const listener = new TouchListener(content, { clickParts: 1 });
      listener.onTouch(() => {
        this.router.go('read', { id: item.id });
      });
      const listContainer = this.fileListContainer;
      let showActions = false;
      const slideActions = function (action, offset) {
        if (action === 'move') {
          const move = showActions ?
            offset > 150 ? 0 : offset < 0 ? Math.max(-10, offset / 2) - 150 : offset - 150 :
            offset > 0 ? 0 : offset < -150 ? Math.max(-160, offset / 2 - 75) : offset;
          li.style.left = move + 'px';
          li.classList.add('file-item-slide');
          listContainer.classList.add('file-item-slide-remove');
        } else {
          li.classList.remove('file-item-slide');
          listContainer.classList.remove('file-item-slide-remove');
          window.requestAnimationFrame(() => {
            if (action === 'cancel') {
              li.style.left = showActions ? '0' : '-150px';
            } else if (action === 'show') {
              showActions = true;
              li.style.left = '-150px';
            } else if (action === 'hide') {
              showActions = false;
              li.style.left = '0';
            }
          });
        }
      };
      listener.onMoveX(offset => slideActions('move', offset));
      listener.onCancelX(() => slideActions('cancel'));
      listener.onSlideLeft(() => slideActions('show'));
      listener.onSlideRight(() => slideActions('hide'));
      const removeHandler = event => {
        file.remove(item.id);
        li.classList.add('file-item-remove');
        setTimeout(() => {
          li.remove();
        }, 100);
        event.stopPropagation();
      };
      const removeButton = li.querySelector('.file-remove');
      removeButton.addEventListener('click', removeHandler);
      removeButton.addEventListener('touchstart', event => {
        if (event.target instanceof Element) {
          if (event.target.closest('li') === li) return;
        }
        slideActions('hide');
      });
      const cancelShowRemove = event => {
        if (!showActions) return;
        const target = event.target;
        if (target instanceof Element) {
          if (target.closest('li') === li) {
            return;
          }
        }
        slideActions('hide');
        event.preventDefault();
      };
      this.fileListContainer.addEventListener('touchstart', cancelShowRemove);
      this.fileListContainer.addEventListener('mousedown', cancelShowRemove);
      this.fileList.appendChild(li);
    });
  }
  clearList() {
    this.fileList.innerHTML = '';
  }
  updateSort() {
    const menuItems = [...document.querySelectorAll('.list-sort-menu [data-option]')];
    const activeItem = menuItems.find(item => item.dataset.option === this.options.sortBy);
    this.sortContent.querySelector('span').textContent = activeItem.textContent;
  }
  sortFiles(/** @type {import('./storage.js').ReaderFileMeta[]} */files) {
    const sortBy = this.options.sortBy;
    const cmp = {
      dateread: (a, b) => b.lastAccessTime - a.lastAccessTime,
      dateadd: (a, b) => b.createTime - a.createTime,
      title: (a, b) => a.title.localeCompare(b.title, navigator.language),
    }[sortBy];
    files.sort(cmp);
  }
}


