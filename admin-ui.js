// Local layout controls work independently of the Firebase module.
const sidebarToggle = document.getElementById('sidebarToggle');
const backdrop = document.getElementById('sidebarBackdrop');
function closeSidebar() {
  document.body.classList.remove('sidebar-open');
  sidebarToggle.setAttribute('aria-expanded', 'false');
  backdrop.hidden = true;
}
sidebarToggle.addEventListener('click', () => {
  if (window.matchMedia('(max-width: 900px)').matches) {
    const open = document.body.classList.toggle('sidebar-open');
    sidebarToggle.setAttribute('aria-expanded', String(open));
    backdrop.hidden = !open;
  } else {
    const collapsed = document.body.classList.toggle('sidebar-collapsed');
    sidebarToggle.setAttribute('aria-expanded', String(!collapsed));
  }
});
backdrop.addEventListener('click', closeSidebar);
document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', () => {
    document.querySelectorAll('.nav-link').forEach(item => item.classList.toggle('active', item === link));
    closeSidebar();
  });
});
document.getElementById('themeToggle').addEventListener('click', event => {
  const dark = document.body.classList.toggle('dark');
  event.currentTarget.setAttribute('aria-pressed', String(dark));
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') closeSidebar();
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k' && !document.getElementById('adminDashboard').classList.contains('hidden')) {
    event.preventDefault();
    document.getElementById('adminSearch').focus();
  }
});
