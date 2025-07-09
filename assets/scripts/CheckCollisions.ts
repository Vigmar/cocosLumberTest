import { _decorator, Component, Node, Vec3 } from "cc";
const { ccclass, property } = _decorator;

@ccclass("CheckCollisions")
export class CheckCollisions extends Component {
  @property(Node)
  tableBox: Node = null;

  @property(Node)
  groundBox: Node = null;

  private _tableRect: any = null;
  private _groundRect: any = null;

  start() {
    this._tableRect = this.getRect(this.tableBox);
    this._groundRect = this.getRect(this.groundBox);
  }

  getRect(node: Node) {
    if (!node) return;

    return {
      x: node.position.x,
      z: node.position.z,
      width: node.scale.x,
      height: node.scale.z,
    };
  }

  checkIsInRect(
    rectCenterX: number,
    rectCenterZ: number,
    halfWidth: number,
    halfHeight: number,
    playerX: number,
    playerZ: number
  ) {
    const rectMinX = rectCenterX - halfWidth;
    const rectMaxX = rectCenterX + halfWidth;
    const rectMinZ = rectCenterZ - halfHeight;
    const rectMaxZ = rectCenterZ + halfHeight;

    // Проверяем, попадает ли точка в прямоугольник
    return (
      playerX >= rectMinX &&
      playerX <= rectMaxX &&
      playerZ >= rectMinZ &&
      playerZ <= rectMaxZ
    );
  }



  public checkCollisionAndAdjustMove(node: Node, move: Vec3): Vec3 {
    
    if (!this._tableRect) return node.position;

    const playerPos = node.worldPosition;
    const futurePos = playerPos.clone().add(move);

    //проверяем что мы не внутри бокса стола
    const isInTableObstacle = this.checkIsInRect(
      this._tableRect.x,
      this._tableRect.z,
      this._tableRect.width / 2,
      this._tableRect.height / 2,
      futurePos.x,
      futurePos.z
    );

    //проверяем что мы внутри забора
    const isInGroundBox = this.checkIsInRect(
      this._groundRect.x,
      this._groundRect.z,
      this._groundRect.width / 2,
      this._groundRect.height / 2,
      futurePos.x,
      futurePos.z
    );

    if (isInTableObstacle || !isInGroundBox) {
      // Не двигаем дальше
      return node.position;
    }

    return futurePos;
  }
}
