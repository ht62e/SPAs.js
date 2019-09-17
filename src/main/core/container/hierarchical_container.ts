import Container, { CssTransitionOptions } from "./container";
import Module from "../module/module";
import RuntimeError from "../common/runtime_error";
import { Parcel, Result } from "../common/dto";
import CssTransitionDriver from "../common/css_transition_driver";

export default class HierarchicalContainer extends Container {
    protected cssTransitionDrivers = new Map<string, CssTransitionDriver>();

    constructor(id: string, bindDomElement: HTMLDivElement, cssTransitionOptions?: CssTransitionOptions) {
        super(id, bindDomElement, cssTransitionOptions);
        bindDomElement.classList.add("fvst_hierarchical_container");
    }

    public async addModule(module: Module): Promise<boolean> {       
        this.mountedModules.set(module.getName(), module);

        await module.mount((element: HTMLDivElement): Container => {
            if (this.cssTransitionOptions && this.cssTransitionOptions.enableCssTransition) {
                const driver = new CssTransitionDriver(element);
                driver.setCustomTransitionClasses(this.cssTransitionOptions.cssTransitionDriverClasses);
                this.cssTransitionDrivers.set(module.getName(), driver);
            }
            this.bindDomElement.appendChild(element);
            return this;
        });

        return true;
    }

    public initialize(parcel?: Parcel): void {
        if (this.defaultModule) {
            this.forward(this.defaultModule, parcel);
        }
    }

    public async forward(module: Module, parcel?: Parcel): Promise<Result> {
        if (this.moduleChangeHistory.indexOf(module) !== -1) return;
        this.moduleChangeHistory.push(module);

        this.activateModule(module, parcel);        

        const result = await module.waitForExit();

        if (!this.inBackProcess) {
            //backメソッドではなく、モジュールの自主的な終了の場合はページを前に戻す
            this.showPreviousModule();
        }

        this.inBackProcess = false;

        return result;
    }

    public activateModule(module: Module, parcel?: Parcel): void {
        if (!this.mountedModules.has(module.getName())) throw new RuntimeError("指定されたモジュールはマウントされていません。");
        
        if (this.activeModule) {
            this.hideModule(this.activeModule);
        }

        module.initialize(parcel);
        this.showModule(module);
        const previousActiveModule = this.activeModule;
        this.activeModule = module;

        //その他モジュールの非表示化
        this.mountedModules.forEach((m: Module) => {
            if (m !== module && m !== previousActiveModule) m.hide();
        });
    }

    protected showModule(targetModule: Module): void {
        let driver: CssTransitionDriver;
        if (driver = this.cssTransitionDrivers.get(targetModule.getName())) {  
            driver.show();
        } else {
            targetModule.show();
        }
    }

    protected hideModule(targetModule: Module): void {
        let driver: CssTransitionDriver;
        if (driver = this.cssTransitionDrivers.get(targetModule.getName())) {
            driver.hide();
        } else {
            targetModule.hide();
        }
    }

    protected showPreviousModule(): void {
        if (this.moduleChangeHistory.length > 0) {
            this.moduleChangeHistory.pop();
        }
        if (this.moduleChangeHistory.length > 0) {
            this.activateModule(this.moduleChangeHistory[this.moduleChangeHistory.length - 1]);
        } else {
            if (this.activeModule) {
                this.hideModule(this.activeModule);
            }
        }
    }
}
