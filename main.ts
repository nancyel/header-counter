import {
	App,
	MarkdownView,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
} from "obsidian";

interface HeaderCounterPluginSettings {
	defaultLevel: string;
}

const DEFAULT_SETTINGS: HeaderCounterPluginSettings = {
	defaultLevel: "4",
};

export default class HeaderCounterPlugin extends Plugin {
	settings: HeaderCounterPluginSettings;

	async onload() {
		console.log("Loading Header Counter Plugin");

		await this.loadSettings();

		this.addRibbonIcon("dice", "Header Counter", () => {
			new HeaderLevelModal(
				this.app,
				(headerLevel) => {
					this.countHeaders(headerLevel);
				},
				parseInt(this.settings.defaultLevel)
			).open();
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new HeaderCounterSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, "click", (evt: MouseEvent) => {
			console.log("click", evt);
		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(
			window.setInterval(() => console.log("setInterval"), 5 * 60 * 1000)
		);

		this.addCommand({
			id: "count-headers",
			name: "Count Headers",
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
			name: "Compute Header Summary",
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
		const activeLeaf = this.app.workspace.getLeaf();
		if (!activeLeaf) {
			new Notice("No active leaf found.");
			return;
		}

		const view = activeLeaf.view;
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
		const activeLeaf = this.app.workspace.getLeaf();
		if (!activeLeaf) {
			new Notice("No active leaf found.");
			return;
		}

		const view = activeLeaf.view;
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
		contentEl.createEl("h2", { text: "Enter Header Level (1-6)" });

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

		containerEl.createEl("h2", { text: "General Settings" });

		new Setting(containerEl)
			.setName("Default Header Level")
			.setDesc("Set the default header level to count.")
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
}
