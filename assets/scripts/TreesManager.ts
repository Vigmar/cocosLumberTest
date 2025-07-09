import {
  _decorator,
  Component,
  Node,
  Prefab,
  instantiate,
  Vec3,
  tween,
  Tween,
} from "cc";

// Перечисление состояний дерева
enum TreeState {
  Ready, // готово к рубке
  Rubbing, // рубится
  CutDown, // срублено
  Growing, // вырастает
}

// Данные дерева
interface TreeData {
  treeNode: Node; // модель дерева
  stumpNode: Node; // модель пня
  state: TreeState; // текущее состояние
  timer: number; // время в текущем состоянии
  currentScale: number; // текущий scaleY для анимации роста
  
}

@_decorator.ccclass("TreesManager")
export class TreesManager extends Component {
  // Префабы
  @_decorator.property({ type: Prefab })
  treePrefab: Prefab = null;

  @_decorator.property({ type: Prefab })
  stumpPrefab: Prefab = null;

  // Параметры сетки
  @_decorator.property
  startX: number = 0;

  @_decorator.property
  startZ: number = 0;

  @_decorator.property
  dx: number = 4;

  @_decorator.property
  dz: number = 4;

  @_decorator.property
  gridWidth: number = 5;

  @_decorator.property
  gridHeight: number = 5;

  // Временные параметры
  private rubbingDuration: number = 1.5;
  private cutDownDuration: number = 7;
  private growingDuration: number = 1;

  // Массив данных о деревьях
  public treesData: TreeData[] = [];

  start() {
    this.generateForest();
  }

  generateForest() {
    if (!this.treePrefab || !this.stumpPrefab) {
      console.error("Не заданы префабы деревьев или пней!");
      return;
    }

    for (let x = 0; x < this.gridWidth; x++) {
      for (let z = 0; z < this.gridHeight; z++) {
        const posX = this.startX + x * this.dx;
        const posZ = this.startZ + z * this.dz;
        const position = new Vec3(posX, 0, posZ);

        // Создать пень
        const stumpNode = instantiate(this.stumpPrefab);
        stumpNode.setPosition(position);
        this.node.addChild(stumpNode);

        // Создать дерево
        const treeNode = instantiate(this.treePrefab);
        treeNode.setPosition(position);
        this.node.addChild(treeNode);

        // Сохранить данные
        this.treesData.push({
          treeNode,
          stumpNode,
          state: TreeState.Ready,
          timer: 0,
          currentScale: 1,
        });

        // Установить начальное состояние
        treeNode.active = true;
        stumpNode.active = false;
      }
    }
  }

  public findMatchingTree(
    lumberjackPosition: Vec3,
    //forwardDirection: Vec3,
    nodeAngle: number = 0,
    maxDistance: number = 3,
    viewAngleDeg: number = 90
  ): { node: Node; index: number; timer: number } | null {
    let closestMatch: { node: Node; index: number; distance: number } | null =
      null;

    let matchedState: TreeState = TreeState.Ready;
    let matchedTimer: number = 0;
    

    for (let i = 0; i < this.treesData.length; i++) {
      const tree = this.treesData[i].treeNode;
      const treeState = this.treesData[i].state;

      const toTree = Vec3.subtract(
        new Vec3(),
        tree.worldPosition,
        lumberjackPosition
      );
      const distance = toTree.length();

      if (distance > maxDistance) continue;

      const direction = new Vec3();
      Vec3.subtract(direction, tree.worldPosition, lumberjackPosition); // Вектор от игрока к дереву

      // Вычисляем угол в радианах между направлением на дерево и осью Z
      const angleRad = Math.atan2(direction.x, direction.z);
      const angle = (angleRad * 180) / Math.PI;

      if (
        (Math.abs(
          (angle > 0 ? angle : 360 + angle) -
            (nodeAngle > 0 ? nodeAngle : 360 + nodeAngle)
        ) <= viewAngleDeg ||
          distance < maxDistance / 2) &&
        (treeState == TreeState.Ready || treeState == TreeState.Rubbing)
      ) {
        if (!closestMatch) {
          closestMatch = {
            node: tree,
            index: i,
            distance: distance,
            
          };

          if (treeState == TreeState.Ready) {
            this.treesData[i].state = TreeState.Rubbing;
            this.treesData[i].timer = 0;
            matchedTimer = 0;
          } else {
            matchedTimer = this.treesData[i].timer;
            
          }
        }
      }
    }

    return closestMatch
      ? {
          node: closestMatch.node,
          index: closestMatch.index,
          timer: matchedTimer,

        }
      : null;
  }

  update(deltaTime: number) {
    for (let data of this.treesData) {
      data.timer += deltaTime;

      switch (data.state) {
        case TreeState.Rubbing:
          // Раскачка дерева
          this.swingTree(
            data.treeNode,
            (3 * data.timer) / this.rubbingDuration
          );

          if (data.timer >= this.rubbingDuration) {
            this.finishChopping(data);
          }
          break;

        case TreeState.CutDown:
          data.stumpNode.active = true;
          data.treeNode.active = false;

          if (data.timer >= this.cutDownDuration) {
            this.startGrowing(data);
          }
          break;

        case TreeState.Growing:
          data.treeNode.active = true;
          data.stumpNode.active = false;

          data.currentScale = Math.min(
            1,
            data.currentScale + deltaTime / this.growingDuration
          );
          data.treeNode.setScale(1, data.currentScale, 1);

          if (data.currentScale >= 1) {
            this.finishGrowing(data);
          }
          break;
      }
    }
  }

  // Начать рубку дерева
  chopTree(index: number) {
    const data = this.treesData[index];

    if (data && data.state === TreeState.Ready) {
      data.state = TreeState.Rubbing;
      data.timer = 0;
      data.currentScale = 1;
      console.log(`Начата рубка дерева ${index}`);
    }
  }

  // Завершить рубку
  private finishChopping(data: TreeData) {
    data.state = TreeState.CutDown;
    data.timer = 0;
    data.treeNode.active = false;
    console.log("Дерево срублено");
  }

  // Начать рост
  private startGrowing(data: TreeData) {
    data.state = TreeState.Growing;
    data.timer = 0;
    data.currentScale = 0.5;
    console.log("Дерево начинает расти");
  }

  // Завершить рост
  private finishGrowing(data: TreeData) {
    data.state = TreeState.Ready;
    data.timer = 0;
    data.currentScale = 1;
    
    console.log("Дерево полностью выросло");
  }


  // Анимация раскачки дерева
  private swingTree(tree: Node, progress: number) {
    const angle = Math.sin(progress * Math.PI * 2) * 10; // колебание ±10 градусов
    tree.eulerAngles = new Vec3(angle, 0, 0);
  }
}
