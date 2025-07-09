import { _decorator, Component, Node } from 'cc';

@_decorator.ccclass('CameraFollow')
export class CameraFollow extends Component {

    // Ссылка на ноду персонажа
    @_decorator.property({ type: Node })
    target: Node = null;

    // Смещение камеры относительно персонажа
    @_decorator.property
    offsetX: number = -10;

    @_decorator.property
    offsetY: number = 15;

    @_decorator.property
    offsetZ: number = 10;


    update(deltaTime: number) {
        if (this.target) {
            // Копируем позицию персонажа и добавляем смещение по Z (или Y, в зависимости от ориентации)
            const newPos = this.target.worldPosition.clone();
            newPos.z += this.offsetZ
			newPos.y = this.offsetY;
			newPos.x +=this.offsetX;

            // Устанавливаем новую позицию камере
            this.node.setPosition(newPos);
        }


    }
}