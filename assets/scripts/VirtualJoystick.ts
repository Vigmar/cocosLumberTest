import {
  _decorator,
  Canvas,
  Component,
  Node,
  EventTouch,
  Input,
  input,
  Vec2,
  Vec3,
  UITransform,
  view,
} from "cc";
const { ccclass, property } = _decorator;

@ccclass("VirtualJoystick")
export class VirtualJoystick extends Component {
  
  @property(Node)
  joystickKnob: Node = null; // Ссылка на ручку джойстика

  @property(Node)
  hintNode: Node = null; // Ссылка на надпись туториала

  @property(Node)
  installNode: Node = null; // Ссылка на install

  @property(Node)
  logoNode: Node = null; // Ссылка на logo

  @property(Node)
  cashNode: Node = null; // Ссылка на cashBar

  @property(UITransform)
  uiTransfrom: UITransform = null;

  @property
  maxRadius: number = 50; // Максимальный радиус перемещения ручки

  private _originPos: Vec3 = new Vec3(); // Исходная позиция джойстика
  private _touchPos: Vec2 = new Vec2(); // Текущая позиция касания
  private _direction: Vec2 = new Vec2(); // Направление джойстика (нормализованное)
  private _isActive: boolean = false; // Активен ли джойстик
  private _tutorialTimer: number = 0;
  private _tutorialShowDelay: number = 5;
  private _installUrl:string = "https://play.google.com/store/apps/details?id=com.lumber.inc";

  get direction(): Vec2 {
    return this._direction;
  }

  get isActive(): boolean {
    return this._isActive;
  }

  onLoad() {
    this.hintNode.active = true;
    
    // Сохраняем исходную позицию
    this._originPos = this.joystickKnob.position.clone();

    // Регистрируем обработчики событий
    input.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
    input.on(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
    input.on(Input.EventType.TOUCH_END, this.onTouchEnd, this);
    input.on(Input.EventType.TOUCH_CANCEL, this.onTouchEnd, this);

    this.updatePosition();
    view.addResizeCallback(this.updatePosition.bind(this));
    this._tutorialTimer = 0;
  }

  update(deltaTime: number) {
    if (!this._isActive) this._tutorialTimer += deltaTime;

    if (this._tutorialTimer >= this._tutorialShowDelay) {
      this.node.setScale(1, 1, 1);
      this.hintNode.active = true;
    }
  }

  updatePosition() {
    const canvas = this.node.getParent().getComponent(UITransform);

    const size = view.getVisibleSize();

    this.node.setPosition(0, -canvas.contentSize.height * 0.2);

    const canvasSize = canvas.contentSize;
    const logoSize = this.logoNode.getComponent(UITransform).contentSize;
    const installSize = this.installNode.getComponent(UITransform).contentSize;
    const cashSize = this.cashNode.getComponent(UITransform).contentSize;

    const padding = 20;

    const posX1 = canvasSize.width / 2 - logoSize.width / 2 - padding;
    const posX2 = canvasSize.width / 2 - installSize.width / 2 - padding;
    const posX3 = -canvasSize.width / 2 + cashSize.width*0.75 + padding;
    const posY1 = canvasSize.height / 2 - logoSize.height / 2 - padding;
    const posY2 = canvasSize.height / 2 - logoSize.height / 2 -installSize.height/2 -3*padding;

    this.logoNode.setPosition(-posX1, posY1); 
    this.installNode.setPosition(-posX2, posY2); 
    this.cashNode.setPosition(-posX3,posY1);
  }

  onDestroy() {
    // Удаляем обработчики при уничтожении
    input.off(Input.EventType.TOUCH_START, this.onTouchStart, this);
    input.off(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
    input.off(Input.EventType.TOUCH_END, this.onTouchEnd, this);
    input.off(Input.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
  }

  onTouchStart(event: EventTouch) {
    const touchPos = event.getUILocation();

    // Проверка, точно ли по спрайту (если нужно)
    const uiTransform = this.installNode.getComponent(UITransform);

    if (uiTransform && uiTransform.getBoundingBoxToWorld().contains(touchPos)) {
      window.open(this._installUrl);

      return;
    }

    this.hintNode.active = false;
    this._tutorialTimer = 0;

    this.node.setScale(1, 1, 1);

    this._isActive = true;
    this._touchPos = touchPos.clone();
    this.updateJoystick();
  }

  onTouchMove(event: EventTouch) {
    if (this._isActive) {
      this._touchPos = event.getUILocation();
      this.updateJoystick();
    }
  }

  onTouchEnd() {
    this._tutorialTimer = 0;
    this.node.setScale(0);

    if (this._isActive) {
      this._isActive = false;
      this._direction = Vec2.ZERO.clone();
      this.joystickKnob.setPosition(this._originPos);
    }
  }

  updateJoystick() {
    // Преобразуем позиции в локальные координаты
    const joystickWorldPos = this.uiTransfrom.convertToWorldSpaceAR(Vec3.ZERO);
    const localPos = new Vec2(
      this._touchPos.x - joystickWorldPos.x,
      this._touchPos.y - joystickWorldPos.y
    );

    // Ограничиваем расстояние до maxRadius
    const distance = Math.min(localPos.length(), this.maxRadius);
    this._direction = localPos.normalize();

    // Устанавливаем новую позицию ручки
    const newPos = new Vec3(
      this._direction.x * distance,
      this._direction.y * distance,
      0
    );

    this.joystickKnob.setPosition(newPos);
  }
}
