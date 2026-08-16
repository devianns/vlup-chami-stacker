import './fonts.css';
import './stacker-ui.css';
import { StackerAppController } from './app/StackerAppController';
import { mountStackerApp } from './ui/StackerAppView';

const app = new StackerAppController(mountStackerApp());
void app.boot();
