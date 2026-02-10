import { Scenes } from 'telegraf';
import { SceneHandler } from '../../../core/domain/scene';
import { BotContext } from './types/bot-context';

export abstract class TelegrafSceneAdapter implements SceneHandler {
    abstract readonly id: string;

    protected scene: Scenes.BaseScene<BotContext>;

    constructor() {
        this.scene = this.createScene();
    }

    protected abstract createScene(): Scenes.BaseScene<BotContext>;

    getScene(): Scenes.BaseScene<BotContext> {
        return this.scene;
    }
}
