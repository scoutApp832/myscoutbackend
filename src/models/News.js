// backend/src/models/News.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const News = sequelize.define('News', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    title: {
      type: DataTypes.STRING(250),
      allowNull: false
    },
    category: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: 'General'
    },
    excerpt: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    image_url: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('draft', 'published'),
      allowNull: false,
      defaultValue: 'draft'
    },
    author_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    published_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'news',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  News.associate = (models) => {
    News.belongsTo(models.User, {
      foreignKey: 'author_id',
      as: 'author'
    });
  };

  return News;
};