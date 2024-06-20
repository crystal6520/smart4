const Sequelize = require("sequelize");

class IotSensors extends Sequelize.Model {
  static initiate(sequelize) {
    IotSensors.init(
      {
        ph: {
          type: Sequelize.DOUBLE,
          allowNull: false,
        },
        temp: {
          type: Sequelize.DOUBLE,
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
        modelName: "IotSensors",
        tableName: "iotsensors",
        timestamps: false,
        underscored: false,
        paranoid: false,
        charset: "utf8",
        collate: "utf8_general_ci",
      }
    );
  }

  static associate(db) {}
}

module.exports = IotSensors;
