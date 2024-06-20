const Sequelize = require("sequelize");

class FeedSetting extends Sequelize.Model {
  static initiate(sequelize) {
    FeedSetting.init(
      {
        feed_count: {
          type: Sequelize.INTEGER.UNSIGNED,
          allowNull: false,
        },
        hour: {
          type: Sequelize.INTEGER.UNSIGNED,
          allowNull: false,
        },
        minute: {
          type: Sequelize.INTEGER.UNSIGNED,
          allowNull: false,
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW,
        },
      },
      {
        sequelize,
        modelName: "FeedSetting",
        tableName: "feed_setting",
        timestamps: false,
        underscored: true,
        paranoid: false,
        charset: "utf8",
        collate: "utf8_general_ci",
      }
    );
  }

  static associate(db) {}
}

module.exports = FeedSetting;
