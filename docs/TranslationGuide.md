# Translation Guide

This guide gives instructions for how to add a new language to
Zonemaster-GUI. The language is assumed to exist in or to be added
to Zonemaster-Engine and Zonemaster-Backend.

When updating a language in use, this document could also be used as
a checklist for where the changes are done.

You should usually read this document from develop branch to make
sure you have the latest version.

## Language code

Zonemaster uses [ISO 639-1] two-letter language codes, normally in
lower case, but in GUI sometimes with first letter in upper case
to make the display nicer. GUI is currently available in the
following languages with the attached language code:

* `da` for Danish language
* `en` for English language
* `es` for Spanish language
* `fi` for Finnish language
* `fr` for French language
* `nb` for Norwegian language
* `sv` for Swedish language


## Extracting translatable strings

When adding new translatable strings to the GUI, they need to be added to each
`messages.<LANG>.xlf` file. This can be done with the following command:

```
npm run i18n:extract
```

This will update each file with the new strings; by default the target value
of new strings is an empty string. All new strings are appended to the end of
the files, obsolete strings are removed from the files.


## Submitting changes

Below are instructions for how to add or modify files. Preferably, submit the
new or updated file as a pull request to Github (see [translators guide] for
Zonemaster-Engine, -CLI and -Backend). Contact the Zonemaster Group if that
does not work.

The translator must always create or update the `messages.<LANG>.xlf`. The
other changes are only done when a language is added and will be completed
by the Zonemaster Group.


## messages.\<LANG\>.xlf

The XLF files `messages.<LANG>.xlf` are XML files and contains the messages
for GUI in respective language, where `<LANG>` is the language code,
e.g. `messages.fr.xlf`.

The files are located in the [src/locale] folder, one file for each
supported language.

Each language file contains a list of `<trans-unit>` elements with a
`<source>` element containing the message in English (the source locale),
and a `<target>` element containing the translated message. Optionally a
`<note>` element can contain context to help the translator.

```xml
<trans-unit datatype="html" id="a434ae37bd56265a0693fbc28bd8338a38500871">
  <source>About Zonemaster</source>
  <target state="new">À propos de Zonemaster</target>
</trans-unit>
```

To help translating the locale files, tools like [Poedit] can be used.

### Poedit

In Poedit, the translator can see the new strings to translated in an accent
color. Additional context for translation, if available, is shown in the
bottom left corner of the window under "Notes for translators".

## Adding a new language

The new language must be added to the following source files:

* [angular.json],
* [src/environments/common.ts],
* [src/assets/app.config.sample.json],
* [zonemaster.conf-example].

and the following documentation file:

* [GUI Configuration].

Then run `npm run i18n:extract` to create and populate the new
translation file.

### angular.json

In `angular.json` locate and update the following sections
* `/projects/zonemaster/i18n/locales`: add a new property named `<LANG>` with a value of object having the `translation` property containing the path to the `messages.<LANG>.xlf` file;
* `/projects/architect/build/configurations`: add a new build configuration named `<LANG>`, with a `localize` property set to an array containing the language code and a `baseHref` property set a URL prefix in the form `/<LANG>/`;
* `/projects/architect/serve/configurations`: add a new serve configuration baled `<LANG>`, with a `browserTarget` set to the name of the build configuration created in the previous step, `zonemaster:build:<LANG>`;
* `/projects/zonemaster/extract-i18n/options/targetFiles`: add the name of the translation file (`messages.<LANG>.xlf`) to the array.

```jsonc
{
  // ...
  "projects": {
    "zonemaster"
      // ...
      "i18n": {
        "locales": {
          // ...
          "<LANG>": {
            "translation": "src/locale/messages.<LANG>.xlf"
          }
        }
      },
      "architect": {
        "build": {
          // ...
          "configurations": {
            // ...
            "<LANG>": {
              "localize": ["<LANG>"],
              "baseHref": "/<LANG>/"
            }
          }
        },
        "serve": {
          // ...
          "configurations": {
            // ...
            "<LANG>": {
              "browserTarget": "zonemaster:build:<LANG>"
            }
          }
        },
        "extract-i18n": {
          // ...
          "options": {
            // ...
            "targetFiles": [
              // ...
              "messages.<LANG>.xlf"
            ],
          }
        }
      }
    }
  },
  // ...
}
```

### common.ts

In `common.ts` locate

```js
languages: {
  'da': 'Dansk',
  ...
}
```
and append the new two-letter language code and the corresponding new
language name.

Also locate
```js
enabledLanguages: ['da', ...]
```
and append the new two-letter language code of the new language.

### app.config.sample.json

In  `app.config.sample.json` locate

```json
"enabledLanguages": ["da", ...]
```
and append the new two-letter language code of the new language.

### zonemaster.conf-example

In the Apache example configuration, `zonemaster.conf-example`, update the rewrite
rules and conditions to add the new language. 

Identify the three places in `zonemaster.conf-example` where there is a list of
language codes. Currently you will find `da|en|es|fi|fr|nb|sv`. Add the two-letter
code of the new language following the same pattern. Preserve the alphabetical order
of the language codes.

### Configuration

Add the new language's two-letter code to the list of default values for
`"enabledLanguages"` in the [GUI Configuration] documentation file.

## Add e2e test script for the language

In `FR05.e2e-spec.ts` add a new test case in the `testSuite` array:

```js
const testSuite = [
      ...
      { language: 'New language name', code: 'two-letter code', expected: '`Domain name` translation in the new language' },
      ...
  ];
```


[ISO 639-1]:                                               https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes
[e2e]:                                                     ../e2e
[FR05-en.e2e-spec.ts]:                                     ../e2e/FR05-en.e2e-spec.ts
[angular.json]:                                            ../angular.json
[src/locale]:                                              ../src/locale
[Translators guide]:                                       https://github.com/zonemaster/zonemaster/blob/master/docs/internal/maintenance/Instructions-for-translators.md
[src/environments/common.ts]:                              ../src/environments/common.ts
[src/assets/app.config.sample.json]:                       ../src/assets/app.config.sample.json
[GUI Configuration]:                                       https://github.com/zonemaster/zonemaster/blob/master/docs/public/configuration/gui.md
[zonemaster.conf-example]:                                 ../zonemaster.conf-example
[Poedit]:                                                  https://poedit.net
