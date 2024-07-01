import {Component, EventEmitter, OnInit, Input, Output, OnChanges, SimpleChange, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import {ViewEncapsulation} from '@angular/core';
import {
  FormGroup,
  FormControl,
  FormArray,
  FormBuilder,
  Validators,
  AbstractControl} from '@angular/forms';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Params } from '@angular/router';
import { Subscription } from 'rxjs';
import { AlertService } from '../../services/alert.service';


@Component({
  selector: 'app-form',
  templateUrl: './form.component.html',
  styleUrls: ['./form.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class FormComponent implements OnInit, OnChanges, OnDestroy {
  @ViewChild('domainInput') domainInputView!: ElementRef<HTMLInputElement>;
  @ViewChild('nameserversForm') nameserversFormView!: ElementRef<HTMLInputElement>;
  @ViewChild('dsInfoForm') dsInfoFormView!: ElementRef<HTMLInputElement>;

  @Input() formProgression;
  @Input() toggleFinished;
  @Input() profiles;

  @Output() onRunTest = new EventEmitter<object>();
  @Output() onFetchDataFromParent = new EventEmitter<[string, string]>();

  private groupWithSubscription = new WeakSet();

  private formConfig = {
    'nameservers': {
        ns: '',
        ip: ''
    },
    'ds_info': {
      keytag: '',
      algorithm: '',
      digtype: '',
      digest: ''
    }
  };

  private formOpts = {
    'ds_info': {
      validators: FormComponent.allOrNoneDSFieldsValidator
    },
    'nameservers':  {
      validators: FormComponent.nsRequiredValidator
    }
  };

  private _showProgressBar: boolean;

  private routeParamsSubscription: Subscription;

  public history = {};
  public test = {};
  public disable_check_button = false;
  public form: FormGroup;

  constructor(private activatedRoute: ActivatedRoute,
    private formBuilder: FormBuilder,
    private titleService: Title,
    private alertService: AlertService) {
    }

  ngOnInit() {
    this.titleService.setTitle('Zonemaster');
    this.generateForm();

    this.routeParamsSubscription = this.activatedRoute.params.subscribe((params: Params) => {
      if ( params['domain'] ) {
        let domainName: string = params['domain'];
        this.form.controls.domain.setValue(domainName);
        this.submitRunTest();
      }
    });
  }

  ngOnChanges(changes: { [property: string]: SimpleChange }) {
    if ('toggleFinished' in changes) {
      this.resetFullForm();
    }
  }

  ngOnDestroy() {
    this.routeParamsSubscription.unsubscribe();
  }

  get nameserversArray() {
    return this.form.get('nameservers') as FormArray;
  }

  get dsInfoArray() {
    return this.form.get('ds_info') as FormArray;
  }

  private static atLeastOneProtocolValidator(control: AbstractControl) {
    const ipv4_disabled = control.get('disable_ipv4');
    const ipv6_disabled = control.get('disable_ipv6');
    return (ipv4_disabled && ipv4_disabled.value === true) && (ipv6_disabled && ipv6_disabled.value === true) ? {
      noProtocol: true
    } : null;
  };

  private static allOrNoneDSFieldsValidator(control: AbstractControl) {
    const keytag = control.get('keytag');
    const algorithm = control.get('algorithm');
    const digest = control.get('digest');
    const digtype = control.get('digtype');

    if (keytag.value || digest.value || algorithm.value || digtype.value ) {
      if (!keytag.value) keytag.setErrors({required: true});
      if (!digest.value) digest.setErrors({required: true});
      if (!algorithm.value) algorithm.setErrors({required: true});
      if (!digtype.value) digtype.setErrors({required: true});
    } else { // reset errors on children
      keytag.setErrors(null);
      digest.setErrors(null);
      algorithm.setErrors(null);
      digtype.setErrors(null);
      control.markAsUntouched();
      control.markAsPristine();
    }

    return null;
  };

  private static nsRequiredValidator(control: AbstractControl) {
    const ns = control.get('ns');
    const ip = control.get('ip');
    if (ip.value && !ns.value)  {
      return ns.setErrors({ required: true });
    } else if (!ip.value && !ns.value) { // reset errros on children
      ns.setErrors(null);
      control.markAsUntouched();
      control.markAsPristine();
    }
    return  null;
  };

  private generateFormRunTest() {
    this.form = new FormGroup({
      domain: new FormControl('', Validators.required),
      disable_ipv4: new FormControl(false),
      disable_ipv6: new FormControl(false),
      profile: new FormControl(this.profiles[0] || 'default'),
      nameservers: new FormArray([]),
      ds_info: new FormArray([]),
    }, {
      validators: FormComponent.atLeastOneProtocolValidator
    });

    this.addNewRow('nameservers');
    this.addNewRow('ds_info');
  }

  public generateForm() {
    this.generateFormRunTest();
  }

  get domain() { return this.form.get('domain'); }

  @Input()
  set parentDataDS(dsList) {
    this.setParentData(dsList, 'ds_info');
  }

  @Input()
  set parentDataNS(nsList) {
    this.setParentData(nsList, 'nameservers');
  }

  private setParentData(dataList: Array<Object>, formName: string) {
    if (this.form) {
      this.disableForm(false);

      this.deleteRow(formName, -1);
      if (dataList.length == 0) {
        this.addNewRow(formName);
        this.alertService.warn($localize `No data found for the zone.`);
      } else {
        dataList.forEach(row => {
          this.addNewRow(formName, row);
        });
        this.alertService.success($localize `Parent data fetched with success.`);
      }
      this.addNewRow(formName);

    }
  }

  @Input()
  set formError(errors: Array<any>) {
    if (!errors) {
      return;
    }

    this.disableForm(false);

    for (let error of errors) {
      let path = error.path.split('/');
      path.shift(); // First element is ""
      let currentForm: AbstractControl = this.form;
      for (let segment of path) {
        currentForm = currentForm.get(segment);
      }
      currentForm.setErrors({'serverError': error.message})
    }

    this.focusFirstError();
  }

  @Input()
  set showProgressBar(show: boolean) {
    this._showProgressBar = show;
    if (!this.form) return;
    this.disableForm(show);
  }

  get showProgressBar() {
    return this._showProgressBar;
  }

  public resetForm() {
    this.form.controls.domain.reset('');
    this.domainInputView.nativeElement.focus();
  }

  public resetFullForm() {
    this.generateForm();
  }

  public addNewRow(formName, value = null) {
    const control = <FormArray>this.form.get(formName);
    const isPrefilled = value !== null;
    if (!isPrefilled) {
      value = this.formConfig[formName];
    }

    const group = this.formBuilder.group(value, this.formOpts[formName]);

    if (!isPrefilled) {
      this.addRowIfFormChange(group, formName);
    } else {
      group.markAsDirty();
    }

    control.push(group);
  }

  public deleteRow(formName, index: number) {
    const control = <FormArray>this.form.get(formName);
    if (index === -1) {
      for ( let i = control.length - 1; i >= 0; i--) {
        control.removeAt(i);
      }
    } else {
      const formElement = formName === 'nameservers' ?
        this.nameserversFormView.nativeElement :
        this.dsInfoFormView.nativeElement;

      if (control.length === 1 || (index === control.length - 1 && !control.at(index - 1).pristine)) {
        control.at(index).reset();
      } else {
        control.removeAt(index);

        const buttons = formElement.querySelectorAll<HTMLInputElement>('button.delete');

        if (index < buttons.length - 1) {
          buttons[index + 1].focus();
        } else {
          buttons[index - 1].focus();
        }
      }

      this.addRowIfFormChange(control.at(control.length - 1), formName);
    }

    return false;
  }

  private addRowIfFormChange(group, formName) {
    if (group.pristine && !this.groupWithSubscription.has(group)) {
      const valueChangesSubscription = group.valueChanges.subscribe((e) => {
        if (group.pristine === false) {
          this.addNewRow(formName);
          valueChangesSubscription.unsubscribe();
          this.groupWithSubscription.delete(group);
        }
      });

      // Avoid subscribing the event multiple times
      this.groupWithSubscription.add(group);
    }
  }

  public fetchDataFromParent(type) {
    this.domain.markAsTouched();
    if (this.domain.invalid) {
      return false;
    }
    this.disableForm();

    this.onFetchDataFromParent.emit([type, this.form.value.domain]);
  }

  public disableForm(disable = true) {
    if (disable) {
      this.form.disable();
    } else {
      this.form.enable();
    }
  }

  // Remove trailing spaces and dots, and leading spaces
  private sanitizeDomain(domain: string): string {
    domain = domain.trim();
    if (domain == '.') {
      return domain;
    } else {
      return domain.replace(/\.$/, '');
    }
  }

  private focusFirstError() {
    // small hack to execute this at the next tick when DOM has been updated
    window.setTimeout(() => document.querySelector<HTMLInputElement>('[aria-invalid="true"]').focus(), 0)
  }

  private submitRunTest() {
    this.form.markAllAsTouched();
    this.form.controls.domain.markAsDirty();
    let param = this.form.value;

    param.domain = this.sanitizeDomain(param.domain);

    if (param.ipv4 === true) delete param.ipv4;

    if (param.disable_ipv4) param.ipv4 = false;
    if (param.disable_ipv6) param.ipv6 = false;
    delete param.disable_ipv4;
    delete param.disable_ipv6;

    param.nameservers = param.nameservers
      .map((x, i) => {
        x.ns = this.sanitizeDomain(x.ns);
        if (!x.ip) {
          delete x.ip;
        }
        return x;
      })
      .filter(ns => ns.ip || ns.ns);

    param.ds_info = param.ds_info
      .filter(ds => ds.keytag || ds.algorithm > 0 || ds.digtype > 0 || ds.digest)
      .map(ds => {return {
        keytag: Number(ds.keytag),
        algorithm: Number(ds.algorithm),
        digtype: Number(ds.digtype),
        digest: ds.digest
      }});

    if (this.form.valid) {
      this.onRunTest.emit(param);
    } else {
      this.focusFirstError();
    }
  }

  public submitForm() {
    console.log('submited')
    this.submitRunTest();
  }
}
