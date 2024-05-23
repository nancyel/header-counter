import {
	App,
	MarkdownView,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	addIcon,
} from "obsidian";
import { ICON_DATA } from "resources/icons";

interface HeaderCounterPluginSettings {
	defaultLevel: string;
	showRibbonIcon: boolean;
}

const DEFAULT_SETTINGS: HeaderCounterPluginSettings = {
	defaultLevel: "4",
	showRibbonIcon: true,
};

export default class HeaderCounterPlugin extends Plugin {
	settings: HeaderCounterPluginSettings;

	async onload() {
		console.log("Loading Header Counter Plugin");

		await this.loadSettings();

		addIcon("header", ICON_DATA);

		if (this.settings.showRibbonIcon) {
			this.addRibbonIcon("header", "Header Counter", () => {
				new HeaderLevelModal(
					this.app,
					(headerLevel) => {
						this.countHeaders(headerLevel);
					},
					parseInt(this.settings.defaultLevel)
				).open();
			}).setAttribute("id", "header-counter-icon");
		}

		this.addSettingTab(new HeaderCounterSettingTab(this.app, this));

		this.addCommand({
			id: "count-headers",
			name: "Count headers",
			checkCallback: (checking: boolean) => {
				if (checking) {
					return true;
				}

				// Prompt user for header level input
				new HeaderLevelModal(
					this.app,
					(headerLevel) => {
						this.countHeaders(headerLevel);
					},
					parseInt(this.settings.defaultLevel)
				).open();
			},
		});

		this.addCommand({
			id: "header-summary",
			name: "Compute header summary",
			checkCallback: (checking: boolean) => {
				if (checking) {
					return true;
				}

				this.computeHeaderSummary();
			},
		});
	}

	onunload() {
		console.log("Unloading Header Counter Plugin");
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async countHeaders(headerLevel: number) {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);

		if (!(view instanceof MarkdownView)) {
			new Notice("Active view is not a Markdown view.");
			return;
		}

		const editor = view.editor;
		const content = editor.getValue();

		const headerRegex = new RegExp(`^#{${headerLevel}}\\s`, "gm");
		const matches = content.match(headerRegex);
		const count = matches ? matches.length : 0;

		new Notice(`Number of level ${headerLevel} headers: ${count}`);
	}

	async computeHeaderSummary() {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);

		if (!(view instanceof MarkdownView)) {
			new Notice("Active view is not a Markdown view.");
			return;
		}

		const editor = view.editor;
		const content = editor.getValue();

		const headerSummary: { [key: string]: number } = {};

		for (let level = 1; level <= 6; level++) {
			const headerRegex = new RegExp(`^#{${level}}\\s`, "gm");
			const matches = content.match(headerRegex);
			headerSummary[`h${level}`] = matches ? matches.length : 0;
		}

		new Notice(`Header Summary: ${JSON.stringify(headerSummary)}`);
		new Notice("Copied to clipboard!");
		navigator.clipboard.writeText(JSON.stringify(headerSummary));
	}
}

class HeaderLevelModal extends Modal {
	callback: (headerLevel: number) => void;
	defaultHeaderLevel: number;

	constructor(
		app: App,
		callback: (headerLevel: number) => void,
		defaultHeaderLevel: number
	) {
		super(app);
		this.callback = callback;
		this.defaultHeaderLevel = defaultHeaderLevel;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.createEl("h2", { text: "Enter header level (1-6)" });

		const input = contentEl.createEl("input", {
			type: "number",
			attr: {
				min: "1",
				max: "6",
				value: this.defaultHeaderLevel.toString(),
				placeholder: this.defaultHeaderLevel.toString(),
			},
		});
		input.addClass("header-input");
		input.focus();

		const button = contentEl.createEl("button", { text: "Count" });
		button.addEventListener("click", () => {
			this.handleCount(input);
		});

		input.addEventListener("keydown", (event) => {
			if (event.key === "Enter") {
				this.handleCount(input);
			}
		});
	}

	handleCount(input: HTMLInputElement) {
		const headerLevel = parseInt(input.value);
		if (headerLevel >= 1 && headerLevel <= 6) {
			this.callback(headerLevel);
			this.close();
		} else {
			new Notice("Please enter a valid header level (1-6).");
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class HeaderCounterSettingTab extends PluginSettingTab {
	plugin: HeaderCounterPlugin;

	constructor(app: App, plugin: HeaderCounterPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		this.add_general_setting_header();
		this.add_setting_header();
		this.add_ribon_icon_setting();
	}

	add_general_setting_header(): void {
		this.containerEl.createEl("h2", { text: "Settings" });
	}

	add_setting_header(): void {
		const desc = document.createDocumentFragment();
		desc.append("Set the default header level to count.");

		new Setting(this.containerEl)
			.setName("Default header level")
			.setDesc(desc)
			.addText((text) =>
				text
					.setPlaceholder("Enter a number between 1 and 6")
					.setValue(this.plugin.settings.defaultLevel.toString())
					.onChange(async (value) => {
						const level = parseInt(value);
						if (level >= 1 && level <= 6) {
							this.plugin.settings.defaultLevel =
								level.toString();
							await this.plugin.saveSettings();
						} else {
							new Notice(
								"Please enter a valid number between 1 and 6."
							);
						}
					})
			);
	}

	add_ribon_icon_setting(): void {
		const desc = document.createDocumentFragment();
		desc.append(
			"If enabled, a button which opens the header counter modal will be added to the Obsidian sidebar."
		);

		new Setting(this.containerEl)
			.setName("Show icon in sidebar")
			.setDesc(desc)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showRibbonIcon)
					.onChange((value) => {
						this.plugin.settings.showRibbonIcon = value;
						this.plugin.saveSettings();
						this.display();
						if (this.plugin.settings.showRibbonIcon) {
							this.plugin
								.addRibbonIcon(
									"header",
									"Header Counter",
									() => {
										new HeaderLevelModal(
											this.app,
											(headerLevel) => {
												this.plugin.countHeaders(
													headerLevel
												);
											},
											parseInt(
												this.plugin.settings
													.defaultLevel
											)
										).open();
									}
								)
								.setAttribute("id", "header-counter-icon");
						} else {
							document
								.getElementById("header-counter-icon")
								?.remove();
						}
					})
			);
	}
}
