export default function ThemeScript() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `(function(){try{var m=localStorage.getItem('photowall-theme')||'system';var d=m==='dark'||(m==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark');var p=localStorage.getItem('photowall-palette')||'mono';if(p!=='mono'&&p!=='blush'&&p!=='mist'&&p!=='sage'&&p!=='lilac'&&p!=='butter')p='mono';document.documentElement.setAttribute('data-palette',p);}catch(e){}})();`,
      }}
    />
  );
}
