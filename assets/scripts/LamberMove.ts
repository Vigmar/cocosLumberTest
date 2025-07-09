import {
  _decorator,
  Component,
  Node,
  Label,
  Vec3,
  Quat,
  instantiate,
  Prefab,
  tween,
  SkeletalAnimation,
  AudioSource,
} from "cc";
const { ccclass, property } = _decorator;

@ccclass("LamberMove")
export class LamberMove extends Component {
  @property
  moveSpeed: number = 5;

  @property(Node)
  virtualJoystick: Node = null;

  @property(Node)
  treesManager: Node = null; // Ссылка на объект с TreesManager

  @property(SkeletalAnimation)
  skAnim: SkeletalAnimation = null;

  @property(Node)
  logBackpack: Node = null;

  @property(Node)
  sellPlace: Node = null;

  @property(Node)
  sellTable: Node = null;

  @_decorator.property({ type: Prefab })
  logPrefab: Prefab = null;

  @property(Node)
  maxLabel: Node = null;
  
  @property(Label)
  cashLabel: Label = null;

  private audioCut: AudioSource = null;
  private audioBlock: AudioSource = null;

  private treeManager: any;
  private collisionManger: any;

  private moneyBalance: number = 0;
  private logsCount: number = 0;
  private _joystick: any = null;
  private _direction = new Vec3();
  private _currentRubbingTree: Node = null;
  private _gatheredWood: number = 0;
  private _sellPlaceCenterAndSize: any = null;
  private _sellPlaceTimer: number = 0;
  private _soldWoodsCount: number = 0;
  private _isInSellPlace: boolean = false;
  private _woodSellPeriod = 0.2;
  private _woodSeelDelay = 0.5;
  private _maxLogsCount: number = 30;

  // Настройки для проверки дерева
  private maxDistanceToTree: number = 3;
  private viewAngleDeg: number = 45;

  // Имена анимаций
  private walkAnimName: string = "Lumber_Walk";
  private chopAnimName: string = "Lumber_Chop";
  private idleAnimName: string = "Lumber_Idle";

  // Текущая анимация
  private currentAnim: string = "";

  onLoad() {
    this.maxLabel.active = false;

    

    if (this.virtualJoystick) {
      this._joystick = this.virtualJoystick.getComponent("VirtualJoystick");
    }

    this.logBackpack.active = false;

    const audioSources = this.getComponents(AudioSource);

    this.audioCut = audioSources[0];
    this.audioBlock = audioSources[1];

  }

  start() {
    this.treeManager = this.treesManager?.getComponent("TreesManager");
    this.collisionManger = this.treesManager?.getComponent("CheckCollisions");
    this._sellPlaceCenterAndSize = this.getNodeBounds(this.sellPlace);
    this.playWalkAnimation();
  }

  getNodeBounds(node: Node) {
    //для определения размеров зоны продажи используем простой Box, чтобы не счиатть по коллайдеру и мешу
    let centerX = node.position.x;
    let centerZ = node.position.z;
    let dx = node.scale.x / 2;
    let dz = node.scale.z / 2;

    return [centerX, centerZ, dx, dz];
  }

  update(deltaTime: number) {
    let isMove = false;

    if (this._joystick && this._joystick.isActive) {
      const joyDirection = this._joystick.direction;

      this._direction.set(-joyDirection.x, 0, joyDirection.y);

      if (this._direction.length() > 0.1) {
        isMove = true;
        Vec3.normalize(this._direction, this._direction);

        const angleRad = (135 * Math.PI) / 180;

        // Создаем кватернион поворота вокруг оси Y
        const quat = new Quat();
        Quat.fromAxisAngle(quat, Vec3.UP, angleRad); // Vec3.UP = (0,1,0)

        // Применяем поворот к вектору
        Vec3.transformQuat(this._direction, this._direction, quat);

        // Поворот персонажа
        const angle = Math.atan2(this._direction.x, this._direction.z);

        this.node.setRotationFromEuler(0, (angle * 180) / Math.PI, 0);

        //Расчет движения с учетом скорости
        const desiredMove = this._direction.multiplyScalar(
          this.moveSpeed * deltaTime
        );

        // Корректировка движения с учетом препятствий
        const adjustedMove = this.collisionManger.checkCollisionAndAdjustMove(
          this.node,
          desiredMove
        );

        //Применяем движение
        this.node.position = adjustedMove;

        this.playWalkAnimation();
      }
    }

    if (!isMove) this.checkForTreeInFront();
    if (!isMove) this.checkIsInSellPlace(deltaTime);

    //если сейчас есть дерево которое рубят
    if (
      this._currentRubbingTree &&
      this._currentRubbingTree.node &&
      this._currentRubbingTree.timer > 0.6 * (this._gatheredWood + 1)
    ) {
      this._gatheredWood += 1;
      if (this.logsCount < this._maxLogsCount) this.logsCount += 1;

      if (this.logsCount == this._maxLogsCount) this.maxLabel.active = true;

      if (this.audioCut) this.audioCut.play();

      this.moveLog(this._currentRubbingTree.node);
    }
  }

  moveLog(treeNode: Node, isReverse: boolean = false) {
    if (!this.logPrefab) return;

    const flyLogNode = instantiate(this.logPrefab);

    flyLogNode.setParent(this.node.scene);
    if (isReverse) flyLogNode.setPosition(this.logBackpack.worldPosition);
    else flyLogNode.setPosition(treeNode.position);
    flyLogNode.setScale(1, 1, 0.5);

    let endPosition = isReverse
      ? treeNode.position
      : this.logBackpack.worldPosition;

    
    const midpoint = Vec3.lerp(
      new Vec3(),
      treeNode.worldPosition,
      this.logBackpack.worldPosition,
      0.5
    );
    midpoint.y += 10;

    tween(flyLogNode)
      .to(0.5, { position: midpoint }, { easing: "linear" }) // Вверх
      .to(0.5, { position: endPosition }, { easing: "linear" }) // Опускаемся к конечной точке
      .call(() => {
        // Убираем объект после завершения анимации
        flyLogNode.destroy();
        if (!isReverse) this.logBackpack.active = true;
      })
      .start();
  }

  checkIsInSellPlace(deltaTime: number) {
    let lumberWorldPos = this.node.getWorldPosition();

    let isPlaceNow =
      lumberWorldPos.x >
        this._sellPlaceCenterAndSize[0] - this._sellPlaceCenterAndSize[2] &&
      lumberWorldPos.x <
        this._sellPlaceCenterAndSize[0] + this._sellPlaceCenterAndSize[2] &&
      lumberWorldPos.z >
        this._sellPlaceCenterAndSize[1] - this._sellPlaceCenterAndSize[3] &&
      lumberWorldPos.z <
        this._sellPlaceCenterAndSize[1] + this._sellPlaceCenterAndSize[3];

    if (!this._isInSellPlace && isPlaceNow) {
      //только зашел в зону
      this._sellPlaceTimer = 0;
      this._isInSellPlace = true;
      this._soldWoodsCount = 0;
    } else if (this._isInSellPlace && !isPlaceNow) {
      //только вышел из зоны
      this._isInSellPlace = false;
    } else if (this._isInSellPlace && isPlaceNow) {
      //увеличиваем таймер времени пребывания в зоне продажи
      this._sellPlaceTimer += deltaTime;

      //алгоримт выдачи деревьев в зону продажи, по таймеру
      if (
        this._sellPlaceTimer >
          this._woodSeelDelay + this._soldWoodsCount * this._woodSellPeriod &&
        this.logsCount > 0
      ) {
        this._soldWoodsCount += 1;
        this.logsCount -= 1;
        this.moneyBalance +=10;
        
        if (this.cashLabel)
           this.cashLabel.string = ""+this.moneyBalance;

        if (this.logsCount < this._maxLogsCount) this.maxLabel.active = false;

        if (this.sellTable) this.moveLog(this.sellTable, true);
        if (this.audioBlock) this.audioBlock.play();
        if (this.logsCount == 0) this.logBackpack.active = false;
      }
    }
  }

  checkForTreeInFront() {
    if (!this.treeManager || !this.treeManager.findMatchingTree) {
      return;
    }

    const position = this.node.worldPosition;

    // Вызываем функцию поиска дерева из TreesManager
    const match = this.treeManager.findMatchingTree(
      position,
      this.node.eulerAngles.y,
      this.maxDistanceToTree,
      this.viewAngleDeg
    );

    if (match)
      if (
        this._currentRubbingTree &&
        this._currentRubbingTree.index == match.index
      )
        this._currentRubbingTree.timer = match.timer;

    if (
      match &&
      (!this._currentRubbingTree ||
        this._currentRubbingTree.index != match.index)
    ) {
      this._currentRubbingTree = { ...match };
      this._gatheredWood = 0;

      this.playChopAnimation();
    } else if (!match) {
      this._currentRubbingTree = null;
      this.playIdleAnimation();
    }
  }

  playChopAnimation() {
    if (!this.skAnim) return;

    if (this.currentAnim !== this.chopAnimName) {
      this.skAnim.crossFade(this.chopAnimName, 0.2);
      this.currentAnim = this.chopAnimName;
      //console.log("Переключено на анимацию рубки");
    }
  }

  playWalkAnimation() {
    if (!this.skAnim) return;

    if (this.currentAnim !== this.walkAnimName) {
      this.skAnim.crossFade(this.walkAnimName, 0.2);
      this.currentAnim = this.walkAnimName;
      //console.log("Переключено на анимацию ходьбы");
    }
  }

  playIdleAnimation() {
    if (!this.skAnim) return;

    if (this.currentAnim !== this.idleAnimName) {
      this.skAnim.crossFade(this.idleAnimName, 0.2);
      this.currentAnim = this.idleAnimName;
      //console.log("Переключено на анимацию ожидания");
    }
  }
}
