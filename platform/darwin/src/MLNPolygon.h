#import <Foundation/Foundation.h>
#import <CoreLocation/CoreLocation.h>

#import "MLNFoundation.h"
#import "MLNMultiPoint.h"
#import "MLNOverlay.h"

#import "MLNTypes.h"

NS_ASSUME_NONNULL_BEGIN

/**
 An `MLNPolygon` object represents a closed shape consisting of four or more
 vertices, specified as `CLLocationCoordinate2D` instances, and the edges that
 connect them. For example, you could use a polygon shape to represent a
 building, a lake, or an area you want to highlight.

 You can add polygon shapes to the map by adding them to an `MLNShapeSource`
 object. Configure the appearance of an `MLNShapeSource`’s or
 `MLNVectorTileSource`’s polygons collectively using an `MLNFillStyleLayer` or
 `MLNSymbolStyleLayer` object. To access a polygon’s attributes, use an
 `MLNPolygonFeature` object.

 Alternatively, you can add a polygon overlay directly to a map view using the
 `-[MLNMapView addAnnotation:]` or `-[MLNMapView addOverlay:]` method. Configure
 a polygon overlay’s appearance using
 `-[MLNMapViewDelegate mapView:strokeColorForShapeAnnotation:]` and
 `-[MLNMapViewDelegate mapView:fillColorForPolygonAnnotation:]`.

 The vertices are automatically connected in the order in which you provide
 them. You should close the polygon by specifying the same
 `CLLocationCoordinate2D` as the first and last vertices; otherwise, the
 polygon’s fill may not cover the area you expect it to. To avoid filling the
 space within the shape, give the polygon a transparent fill or use an
 `MLNPolyline` object.

 A polygon may have one or more interior polygons, or holes, that you specify as
 `MLNPolygon` objects with the `+polygonWithCoordinates:count:interiorPolygons:`
 method. For example, if a polygon represents a lake, it could exclude an island
 within the lake using an interior polygon. Interior polygons may not themselves
 have interior polygons. To represent a shape that includes a polygon within a
 hole or, more generally, to group multiple polygons together in one shape, use
 an `MLNMultiPolygon` or `MLNShapeCollection` object.

 To make the polygon straddle the antimeridian, specify some longitudes less
 than −180 degrees or greater than 180 degrees.
 
 #### Related examples
 See the <a href="https://docs.mapbox.com/ios/maps/examples/polygon/">
 Add a polygon annotation</a> example to learn how to initialize an
 `MLNPolygon` object from an array of coordinates.
 */
MLN_EXPORT
@interface MLNPolygon : MLNMultiPoint <MLNOverlay>

/**
 The array of polygons nested inside the receiver.

 The area occupied by any interior polygons is excluded from the overall shape.
 Interior polygons should not overlap. An interior polygon should not have
 interior polygons of its own.

 If there are no interior polygons, the value of this property is `nil`.
 */
@property (nonatomic, nullable, readonly) NSArray<MLNPolygon *> *interiorPolygons;

/**
 Creates and returns an `MLNPolygon` object from the specified set of
 coordinates.

 @param coords The array of coordinates defining the shape. The data in this
    array is copied to the new object.
 @param count The number of items in the `coords` array.
 @return A new polygon object.
 */
+ (instancetype)polygonWithCoordinates:(const CLLocationCoordinate2D *)coords count:(NSUInteger)count;

/**
 Creates and returns an `MLNPolygon` object from the specified set of
 coordinates and interior polygons.

 @param coords The array of coordinates defining the shape. The data in this
    array is copied to the new object.
 @param count The number of items in the `coords` array.
 @param interiorPolygons An array of `MLNPolygon` objects that define regions
    excluded from the overall shape. If this array is `nil` or empty, the shape
    is considered to have no interior polygons.
 @return A new polygon object.
 */
+ (instancetype)polygonWithCoordinates:(const CLLocationCoordinate2D *)coords count:(NSUInteger)count interiorPolygons:(nullable NSArray<MLNPolygon *> *)interiorPolygons;

@end

/**
 An `MLNMultiPolygon` object represents a shape consisting of one or more
 polygons that do not overlap. For example, you could use a multipolygon shape
 to represent the body of land that consists of an island surrounded by an
 atoll: the inner island would be one `MLNPolygon` object, while the surrounding
 atoll would be another. You could also use a multipolygon shape to represent a
 group of disconnected but related buildings.

 You can add multipolygon shapes to the map by adding them to an
 `MLNShapeSource` object. Configure the appearance of an `MLNShapeSource`’s or
 `MLNVectorTileSource`’s multipolygons collectively using an `MLNFillStyleLayer`
 or `MLNSymbolStyleLayer` object.

 You cannot add an `MLNMultiPolygon` object directly to a map view using
 `-[MLNMapView addAnnotation:]` or `-[MLNMapView addOverlay:]`. However, you can
 add the `polygons` array’s items as overlays individually.
 */
MLN_EXPORT
@interface MLNMultiPolygon : MLNShape <MLNOverlay>

/**
 An array of polygons forming the multipolygon.
 */
@property (nonatomic, copy, readonly) NSArray<MLNPolygon *> *polygons;

/**
 Creates and returns a multipolygon object consisting of the given polygons.

 @param polygons The array of polygons defining the shape.
 @return A new multipolygon object.
 */
+ (instancetype)multiPolygonWithPolygons:(NSArray<MLNPolygon *> *)polygons;

@end

NS_ASSUME_NONNULL_END
