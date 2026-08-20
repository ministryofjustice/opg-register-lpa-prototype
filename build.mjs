import fs from 'node:fs/promises';
import nunjucks from 'nunjucks';
import { dirname, join } from 'path';
import * as sass from 'sass';

const macros = `
{% from "govuk/components/accordion/macro.njk"           import govukAccordion %}
{% from "govuk/components/back-link/macro.njk"           import govukBackLink %}
{% from "govuk/components/breadcrumbs/macro.njk"         import govukBreadcrumbs %}
{% from "govuk/components/button/macro.njk"              import govukButton %}
{% from "govuk/components/character-count/macro.njk"     import govukCharacterCount %}
{% from "govuk/components/checkboxes/macro.njk"          import govukCheckboxes %}
{% from "govuk/components/cookie-banner/macro.njk"       import govukCookieBanner %}
{% from "govuk/components/date-input/macro.njk"          import govukDateInput %}
{% from "govuk/components/details/macro.njk"             import govukDetails %}
{% from "govuk/components/error-message/macro.njk"       import govukErrorMessage %}
{% from "govuk/components/error-summary/macro.njk"       import govukErrorSummary %}
{% from "govuk/components/exit-this-page/macro.njk"      import govukExitThisPage %}
{% from "govuk/components/fieldset/macro.njk"            import govukFieldset %}
{% from "govuk/components/file-upload/macro.njk"         import govukFileUpload %}
{% from "govuk/components/footer/macro.njk"              import govukFooter %}
{% from "govuk/components/header/macro.njk"              import govukHeader %}
{% from "govuk/components/hint/macro.njk"                import govukHint %}
{% from "govuk/components/input/macro.njk"               import govukInput %}
{% from "govuk/components/inset-text/macro.njk"          import govukInsetText %}
{% from "govuk/components/label/macro.njk"               import govukLabel %}
{% from "govuk/components/notification-banner/macro.njk" import govukNotificationBanner %}
{% from "govuk/components/pagination/macro.njk"          import govukPagination %}
{% from "govuk/components/panel/macro.njk"               import govukPanel %}
{% from "govuk/components/password-input/macro.njk"      import govukPasswordInput %}
{% from "govuk/components/phase-banner/macro.njk"        import govukPhaseBanner %}
{% from "govuk/components/radios/macro.njk"              import govukRadios %}
{% from "govuk/components/select/macro.njk"              import govukSelect %}
{% from "govuk/components/service-navigation/macro.njk"  import govukServiceNavigation %}
{% from "govuk/components/skip-link/macro.njk"           import govukSkipLink %}
{% from "govuk/components/summary-list/macro.njk"        import govukSummaryList %}
{% from "govuk/components/table/macro.njk"               import govukTable %}
{% from "govuk/components/tabs/macro.njk"                import govukTabs %}
{% from "govuk/components/tag/macro.njk"                 import govukTag %}
{% from "govuk/components/task-list/macro.njk"           import govukTaskList %}
{% from "govuk/components/textarea/macro.njk"            import govukTextarea %}
{% from "govuk/components/warning-text/macro.njk"        import govukWarningText %}
`

function usage() {
  console.log(`usage: node build.mjs [--service-url URL] [--dir DIRECTORY]`);
  process.exit(1);
}

async function findViews(dir) {
  const views = [];
  dir = join('.', dir);

  const search = async function(subdir) {
    const paths = await fs.readdir(subdir);
    for (let p of paths) {
      p = join(subdir, p);
      const stat = await fs.stat(p);
      if (stat.isDirectory()) {
        await search(p);
      } else {
        views.push({ full: p, rel: p.slice(dir.length + 1) });
      }
    }
  }

  await search(dir);
  return views;
}

async function renderHtml(out, mrlpaServiceUrl) {
  const env = new nunjucks.Environment([
    new nunjucks.FileSystemLoader('./app/views'),
    new nunjucks.FileSystemLoader('./node_modules/govuk-prototype-kit/lib/nunjucks'),
    new nunjucks.FileSystemLoader('./node_modules/govuk-frontend/dist'),
  ]);

  env.addGlobal('pluginVersionSatisfies', () => true);
  env.addGlobal('govukRebrand', () => true);

  const views = await findViews('app/views');

  for (const view of views) {
    const contents = await fs.readFile(view.full);

    const rendered = env.renderString(`
${macros}
${contents.toString()}
`, {
      assetPath: '/assets',
      data: { mrlpa_service_url: mrlpaServiceUrl },
    });

    const outpath = join(out, view.rel.slice(0, view.rel.length - 5), 'index.html');
    const outdir = dirname(outpath);
    try {
      await fs.stat(outdir);
    } catch {
      await fs.mkdir(outdir, { recursive: true });
    }

    await fs.writeFile(outpath, rendered);
  }
}

async function copyAssets(out) {
  const sassContents = await fs.readFile('./app/assets/sass/application.scss');
  const { css } = sass.compileString(`
@use "govuk-frontend/dist/govuk/index.scss" as *;
@use "govuk-frontend/dist/govuk/helpers/_typography.scss" as *;
// When @govuk-prototype-kit/common-templates is updated, these can be included
// @use "sass/_contents-list.scss" as *;
// @use "sass/_mainstream-guide.scss" as *;
@use "@govuk-prototype-kit/common-templates/sass/_related-items.scss" as *;

${sassContents.toString()}

p { @extend .govuk-body };
a { @extend .govuk-link };
`, {
    loadPaths: [
      './app/assets/sass',
      './node_modules',
    ],
  });
  await fs.mkdir(join(out, '/public/stylesheets'), { recursive: true });
  await fs.writeFile(join(out, 'public/stylesheets/application.css'), css);

  await fs.cp('./node_modules/govuk-frontend/dist/govuk/assets/fonts', join(out, '/assets/fonts'), { recursive: true });
  await fs.cp('./node_modules/govuk-frontend/dist/govuk/assets/images', join(out, '/assets/images'), { recursive: true });
}

const argv = process.argv.slice(2);

let serviceUrl = 'http://example.com';
let dir = './out';

if (argv.length % 2 != 0) { usage(); }

for (let i = 0; i < argv.length - 1; i += 2) {
  switch (argv[i]) {
    case '--service-url':
      serviceUrl = argv[i + 1];
      break;
    case '--dir':
      dir = argv[i + 1];
      break;
    default:
      usage();
  }
}

console.log(`building to ${dir} with service url ${serviceUrl} `);
renderHtml(dir, serviceUrl);
copyAssets(dir);
