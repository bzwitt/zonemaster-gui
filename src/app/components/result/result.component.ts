import { Component, OnInit, Input, ElementRef, ViewChild, OnDestroy, Inject, LOCALE_ID } from '@angular/core';
import {ViewEncapsulation} from '@angular/core';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { saveAs } from 'file-saver';
import { Subscription } from 'rxjs';
import { DnsCheckService } from '../../services/dns-check.service';
import { AlertService } from '../../services/alert.service';
import { NavigationService } from '../../services/navigation.service';
import { formatDate, Location } from '@angular/common';
import { Title } from '@angular/platform-browser';
import * as punycode from 'punycode/';

@Component({
  selector: 'app-result',
  templateUrl: './result.component.html',
  styleUrls: ['./result.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class ResultComponent implements OnInit, OnDestroy {

  @Input('testId') testId: string;
  @ViewChild('resultView', {static: false}) resultView: ElementRef;
  @ViewChild('historyModal', {static: false}) historyModal: ElementRef;

  public displayForm = false;
  public form = {ipv4: true, ipv6: true, profile: 'default_profile', domain: ''};
  public unicodeDomain = '';
  public asciiDomain = '';
  public result = [];
  public modules: any;
  public severity_icons = {
    'info': 'fa-check',
    'notice': 'fa-exclamation',
    'warning': 'fa-exclamation-triangle',
    'error': 'fa-times-circle',
    'critical': 'fa-times-circle'
  };
  public severityLevelNames = {
    'info': $localize `Info`,
    'notice': $localize `Notice`,
    'warning': $localize `Warning`,
    'error': $localize `Error`,
    'critical': $localize `Critical`,
  };
  public moduleNames = {
    'system': $localize `System`,
    'basic': $localize `Basic`,
    'address': $localize `Address`,
    'connectivity': $localize `Connectivity`,
    'consistency': $localize `Consistency`,
    'delegation': $localize `Delegation`,
    'dnssec': $localize `DNSSEC`,
    'nameserver': $localize `Nameserver`,
    'syntax': $localize `Syntax`,
    'zone': $localize `Zone`,
  };
  public searchQueryLength = 0;
  public test: any = {params: {ipv4: false, ipv6: false}};
  public isCollapsed = [];
  public testCasesCount = {
    all: 0,
    info: 0,
    notice: 0,
    warning: 0,
    error: 0,
    critical: 0,
  };
  public testCasesCountByModule = {};
  public resultFilter = {
    all: true,
    info: false,
    notice: false,
    warning: false,
    error: false,
    critical: false,
    search: ''
  };
  public severityLevels = {
    info: 0,
    notice: 1,
    warning: 2,
    error: 3,
    critical: 4,
  };
  public testCaseDescriptions = {};
  public historyQuery: object;
  public history: any[];
  public navHeight: Number;
  private header = ['Module', 'Level', 'Message'];
  private navHeightSubscription: Subscription;

  private routeParamsSubscription: Subscription;

  constructor(private activatedRoute: ActivatedRoute,
              private router: Router,
              private modalService: NgbModal,
              private alertService: AlertService,
              private dnsCheckService: DnsCheckService,
              private navigationService: NavigationService,
              private location: Location,
              private titleService: Title,
              @Inject(LOCALE_ID) private language: string) {

    let data = this.router.getCurrentNavigation().extras.state || {};
    this.displayForm = data.displayForm === undefined ? false : data.displayForm;
  }

  ngOnInit() {
    this.routeParamsSubscription = this.activatedRoute.params.subscribe((params: Params) => {
      this.testId = params['testId'];
      this.fetchResult(this.testId);
    });

    this.navHeightSubscription = this.navigationService.height.subscribe((newHeight: Number) => {
      this.navHeight = newHeight;
    });
  }

  ngOnDestroy() {
    this.navHeightSubscription.unsubscribe();

    if (this.routeParamsSubscription) {
      this.routeParamsSubscription.unsubscribe();
    }
  }

  public openModal(content) {
    this.modalService.open(content).result.then((result) => {
      console.log(result)
    }, (reason) => {
      console.log(reason);
    });
  }

  public expandAll() {
    for (const module of this.modules) {
      this.isCollapsed[module.name] = false;
    }
  }

  public collapseAll() {
    for (const module of this.modules) {
      this.isCollapsed[module.name] = true;
    }
  }

  private fetchResult(testId: string, resetCollapsed = true) {
    this.dnsCheckService.getTestResults(testId).then(data => {
      // TODO clean

      this.test = {
        id: data['hash_id'],
        creation_time: new Date(data['created_at']),
        location: document.location.origin + this.location.prepareExternalUrl(`/result/${testId}`)
      };

      this.historyQuery = data['params'];
      this.result = data['results'];
      this.form = data['params'];
      this.unicodeDomain = punycode.toUnicode(this.form.domain);
      this.asciiDomain = punycode.toASCII(this.form.domain);
      this.testCaseDescriptions = data['testcase_descriptions'];

      this.testCasesCount = this.displayResult(this.result, resetCollapsed);

      this.testCasesCountByModule = {};

      for (const module of this.modules) {
        const levels = {};
        for (const testcase of module.testcases) {
          const level = testcase.level;

          if (!(level in levels)) {
            levels[level] = 0;
          }

          levels[level] ++;
        }

        this.testCasesCountByModule[module.name] = Object.entries(this.severityLevels).sort(([, numLevel1], [_, numLevel2]) => numLevel2 - numLevel1)
          .filter(([levelId, _]) => levelId in levels)
          .map(([levelId, _]) => {
            return {
              name: levelId,
              value: levels[levelId]
            }
          });
      }

      this.titleService.setTitle(`${this.unicodeDomain} · Zonemaster`);
    }, error => {
      this.alertService.error($localize `No data for this test.`)
    });
  }

  private displayResult(results: Array<Object>, resetCollapsed: boolean) {
    const testCasesCount = {
      'all': 0,
      'info': 0,
      'notice': 0,
      'warning': 0,
      'error': 0,
      'critical': 0,
    }

    this.modules = [];
    const modulesMap = {};

    for (const entry of results) {
      const currentModule = entry['module'];
      const currentTestcase = entry['testcase'];
      const currentLevel = entry['level'].toLowerCase();
      const numLevel = this.severityLevels[currentLevel];

      entry['level'] = currentLevel;

      if (!(currentModule in modulesMap)) {
        modulesMap[currentModule] = {name: currentModule, testcases: [], testcasesMap: {}}

        this.modules.push(modulesMap[currentModule]);
      }

      if (!(currentTestcase in modulesMap[currentModule].testcasesMap)) {
        modulesMap[currentModule].testcasesMap[currentTestcase] = {
          id: currentTestcase,
          entries: [],
          level: 'info'
        }

        modulesMap[currentModule].testcases.push(modulesMap[currentModule].testcasesMap[currentTestcase]);

        if (resetCollapsed || !(currentTestcase in this.isCollapsed)) {
          this.isCollapsed[currentTestcase] = true;
          this.isCollapsed[currentModule] = true;
        }
      }

      modulesMap[currentModule].testcasesMap[currentTestcase].entries.push(entry);

      if (numLevel > this.severityLevels[modulesMap[currentModule].testcasesMap[currentTestcase].level]) {
        modulesMap[currentModule].testcasesMap[currentTestcase].level = currentLevel;
      }
    }

    for (const module in modulesMap) {
      modulesMap[module].testcases.sort((testcase1, testcase2) => {
        // sort messages by descending severity level, unspecified messages always on top
        if (testcase1.id.toUpperCase() == 'UNSPECIFIED') {
          return 1;
        }
        if (testcase2.id.toUpperCase() == 'UNSPECIFIED') {
          return 1;
        }
        return this.severityLevels[testcase2.level] - this.severityLevels[testcase1.level];
      })
      for (const testcase in modulesMap[module].testcasesMap) {
        const level = modulesMap[module].testcasesMap[testcase].level;

        testCasesCount[level] ++;
        testCasesCount['all'] ++;
        modulesMap[module].testcasesMap[testcase].entries.sort((msg1, msg2) => {
          // sort messages by descending severity level
          return this.severityLevels[msg2.level] - this.severityLevels[msg1.level];
        })
      }
    }

    for (const testCase in this.isCollapsed) {
      if (testCase.toUpperCase() == 'UNSPECIFIED') {
        this.isCollapsed[testCase] = false;
      }
    }

    return testCasesCount;
  }

  public getHistory() {
    if (!this.history) {
      this.alertService.info($localize `History information request is in progress.`);

      this.dnsCheckService.getTestHistory(this.historyQuery).then(data => {
        this.history = data as any[];
        if (this.history.length === 0) {
          this.alertService.info($localize `No previous tests found for this domain.`);
        } else {
          this.openModal(this.historyModal);
        }
      });
    } else {
      this.openModal(this.historyModal);
    }
  }

  public getModuleName(moduleName) {
    const moduleKey = moduleName.toLowerCase();
    if (moduleKey in this.moduleNames) {
      return this.moduleNames[moduleKey];
    } else {
      return moduleName;
    }
  }

  private exportedName(extension) {
    return `zonemaster_result_${this.asciiDomain}_${this.test.id}.${extension}`
  }

  public exportJson() {
    const blob = new Blob([JSON.stringify(this.result)], {
      type: 'application/javascript'
    });

    saveAs(blob, this.exportedName('json'));
  }

  public exportHTML() {
    let tbodyContent = '';
    for (let item of this.result) {
      tbodyContent += `
        <tr>
          <td>${this.getModuleName(item.module)}</td>
          <td>${this.severityLevelNames[item.level.toLowerCase()]}</td>
          <td>${item.message}</td>
        </tr>
      `;
    }

    const result = `
      <!doctype html>
      <html lang="${this.language}">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0, shrink-to-fit=no">
          <title>${this.asciiDomain} • Zonemaster Test Result</title>
          <style>
            th,td {
              text-align: left;
              font-weight: normal;
              padding: 0.75rem;
            }
            thead {
              background-color: #212529;
              color: #fff;
            }
            body td {
              border-top: 1px solid #dee2e6;
            }
            body {
              color: #212529;
              font-family: sans;
              margin-left: 20px;
            }
            table {
              border: none;
            }
            tbody tr:nth-child(odd) {
              background-color: rgba(0,0,0,.05);
            }
            h2 {
              font-weight: normal;
              font-size: 2rem;
              margin: .5rem 0;
            }
          </style>
        </head>
        <body>
          <header>
            <h2>${this.asciiDomain}</h2><i>${formatDate(this.test.creation_time, 'yyyy-MM-dd HH:mm zzzz', 'en')}</i>
          </header>
          <table cellspacing="0" cellpadding="0">
            <thead>
              <tr>
                <th scope="col">${$localize `Module`}</th>
                <th scope="col">${$localize `Level`}</th>
                <th scope="col">${$localize `Message`}</th>
              </tr>
            </thead>
            <tbody>
              ${tbodyContent}
            </tbody>
          </table>
        </body>
      </html>
    `;

    const blob = new Blob([result], {
      type: 'text/html;charset=utf-8'
    });

    saveAs(blob, this.exportedName('html'));
  }

  public exportText() {
    const csvData = this.ConvertTo([...this.result].slice(0), 'txt');
    const blob = new Blob([csvData], {
      type: 'text/plain;charset=utf-8'
    });

    saveAs(blob, this.exportedName('txt'));
  }

  public exportCSV() {
    const csvData = this.ConvertTo([...this.result].slice(0), 'csv');
    const blob = new Blob([csvData], {
      type: 'text/csv;charset=utf-8'
    });
    saveAs(blob, this.exportedName('csv'));
  }

  ConvertTo(objArray, extension: string) {
    const array = typeof objArray !== 'object' ? JSON.parse(objArray) : objArray;
    let str = '';
    let row = '';

    for (const indexObj of this.header) {
      if (extension === 'csv') {
        row += indexObj + ';';
      } else {
        row += indexObj + ' \t';
      }
    }
    row = row.slice(0, -1);
    str += row + '\r\n';

    for (let i = 1; i < array.length; i++) {
      let line = '';
      for (const index of this.header) {
        if (line !== '') {
          if (extension === 'csv') {
            line += ';';
          } else {
            line += ' \t';
          }
        }
        line += array[i][index.toLowerCase()].trim();
      }
      str += line + '\r\n';
    }
    return str;
  }

  public togglePillFilter(name) {
    this.resultFilter[name] = !this.resultFilter[name];
    const atLeastOneActive = Object.keys(this.resultFilter).slice(1, -1).filter(el => this.resultFilter[el]);
    this.searchQueryLength = atLeastOneActive.length;

    if (atLeastOneActive.length < 1) {
      this.resultFilter['all'] = true;
    } else if (name === 'all') {
      for (const index of Object.keys(this.resultFilter).slice(1, -1)) {
        this.resultFilter[index] = false;
      }
      this.resultFilter['all'] = true;
      this.searchQueryLength = -1;
    } else {
      this.resultFilter['all'] = false;
    }

    this.filterResults()
  }

  public filterResults() {
    const filteredResults = this.filterResultsSearch(
      this.filterResultsLevel(this.result, this.resultFilter),
      this.resultFilter['search']
    );
    this.displayResult(filteredResults, false);
  }

  private filterResultsLevel(results: any[], levelFilter: Object) {
    if (levelFilter['all']) {
      return results;
    } else {
      const levels = Object.entries(levelFilter)
        .filter(([_key, value]) => value === true)
        .map(([key, _value]) => key);

      return results.filter(entry => levels.includes(entry.level.toLowerCase()));
    }
  }

  private filterResultsSearch(results: any[], query: string) {
    if (!query) {
      return results;
    }
    const queryLower = query.toLocaleLowerCase()
    return results.filter(entry => entry.message.toLowerCase().includes(queryLower));
  }

  // inspired from
  // https://stackoverflow.com/questions/400212/how-do-i-copy-to-the-clipboard-in-javascript#30810322
  public copyLinkToClipboard(str) {
    var btnClipboard = document.getElementsByClassName("btn-clipboard")[0];
    var icon = btnClipboard.firstElementChild;

    var resetIcon = function(oldIcon) {
      setTimeout(function() {
        icon.classList.remove(oldIcon);
        icon.classList.add("fa-clipboard");
      }, 2000);
    };

    var textArea = document.createElement("textarea");
    textArea.value = str;

    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.position = "fixed";

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    var res = document.execCommand('copy');

    if (res === true) {
      icon.classList.remove("fa-clipboard");
      icon.classList.add("fa-check");

      resetIcon("fa-check");
    } else {
      icon.classList.remove("fa-clipboard");
      icon.classList.add("fa-remove");

      resetIcon("fa-remove");
    }

    document.body.removeChild(textArea);
  }

}
