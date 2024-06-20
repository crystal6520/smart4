const Sequelize = require("sequelize");

class WaterSupplyLogs extends Sequelize.Model {
  static initiate(sequelize) {
    WaterSupplyLogs.init(
      {
        date: {
          type: Sequelize.DATEONLY,
          allowNull: false,
          
        },
        time: {
          type: Sequelize.TIME,
          allowNull: false,
          
        },
        quantity: {
          type: Sequelize.INTEGER,
          allowNull: false,
        },
      
      },
      {
        sequelize,
        modelName: "WaterSupplyLogs",
        tableName: "water_supply_logs",
        timestamps: false,
        underscored: false,
        paranoid: false,
        charset: "utf8",
        collate: "utf8_general_ci",
      }
    );
  }

  static associate(db) {
  
  }
}

module.exports = WaterSupplyLogs;
